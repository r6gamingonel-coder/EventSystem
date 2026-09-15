import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { saveUploadedImage } from "@/lib/media";

// Accepts either JSON { mediaAssetIds: string[] } (pick from existing library)
// or multipart form-data with one or more "files" entries (direct multi-upload).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id: albumId } = await params;
  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) return jsonError("الألبوم غير موجود.", 404);

  const maxOrder = await prisma.photo.aggregate({
    where: { albumId },
    _max: { order: true },
  });
  let nextOrder = (maxOrder._max.order ?? -1) + 1;

  const contentType = request.headers.get("content-type") ?? "";
  let mediaAssetIds: string[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return jsonError("لم يتم اختيار ملفات.");
    for (const file of files) {
      try {
        const saved = await saveUploadedImage(file);
        const asset = await prisma.mediaAsset.create({
          data: {
            url: saved.url,
            width: saved.width,
            height: saved.height,
            blurDataUrl: saved.blurDataUrl,
            sizeBytes: saved.sizeBytes,
          },
        });
        mediaAssetIds.push(asset.id);
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : "فشل رفع إحدى الصور.");
      }
    }
  } else {
    const body = await request.json().catch(() => null);
    const parsed = z.object({ mediaAssetIds: z.array(z.string()).min(1) }).safeParse(body);
    if (!parsed.success) return jsonError("يرجى اختيار صور لإضافتها.");
    mediaAssetIds = parsed.data.mediaAssetIds;
  }

  const photos = await prisma.$transaction(
    mediaAssetIds.map((mediaAssetId) =>
      prisma.photo.create({
        data: { albumId, mediaAssetId, order: nextOrder++ },
        include: { mediaAsset: true },
      }),
    ),
  );

  if (!album.coverImageId && photos[0]) {
    await prisma.album.update({
      where: { id: albumId },
      data: { coverImageId: photos[0].mediaAssetId },
    });
  }

  await logAudit({
    adminId: auth.admin.id,
    action: "CREATE",
    entity: "PHOTO",
    entityId: albumId,
    metadata: { count: photos.length },
  });

  return NextResponse.json({ photos });
}

const reorderSchema = z.object({ orderedPhotoIds: z.array(z.string()) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id: albumId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonError("بيانات غير صالحة.");

  await prisma.$transaction(
    parsed.data.orderedPhotoIds.map((photoId, index) =>
      prisma.photo.update({ where: { id: photoId }, data: { order: index } }),
    ),
  );

  await logAudit({ adminId: auth.admin.id, action: "UPDATE", entity: "PHOTO", entityId: albumId });

  return NextResponse.json({ ok: true });
}
