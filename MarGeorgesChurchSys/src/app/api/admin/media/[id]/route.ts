import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { deleteUploadedImage } from "@/lib/media";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return jsonError("الملف غير موجود.", 404);

  try {
    await prisma.mediaAsset.delete({ where: { id } });
  } catch {
    return jsonError("هذه الصورة مستخدمة حالياً في مكان آخر بالموقع. أزلها من هناك أولاً.");
  }

  await deleteUploadedImage(asset.url);

  await logAudit({ adminId: auth.admin.id, action: "DELETE", entity: "MEDIA_ASSET", entityId: id });

  return NextResponse.json({ ok: true });
}
