import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError, GENERIC_ERROR } from "@/lib/api-guard";
import { saveUploadedImage } from "@/lib/media";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const assets = await prisma.mediaAsset.findMany({
    where: q ? { alt: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return jsonError("لم يتم اختيار ملف.");
  }

  try {
    const saved = await saveUploadedImage(file);
    const asset = await prisma.mediaAsset.create({
      data: {
        url: saved.url,
        width: saved.width,
        height: saved.height,
        blurDataUrl: saved.blurDataUrl,
        sizeBytes: saved.sizeBytes,
        alt: (formData?.get("alt") as string) || null,
      },
    });

    await logAudit({
      adminId: auth.admin.id,
      action: "CREATE",
      entity: "MEDIA_ASSET",
      entityId: asset.id,
    });

    return NextResponse.json({ asset });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : GENERIC_ERROR);
  }
}
