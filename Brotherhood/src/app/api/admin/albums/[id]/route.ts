import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      coverImage: true,
      photos: { include: { mediaAsset: true }, orderBy: { order: "asc" } },
    },
  });
  if (!album) return jsonError("الألبوم غير موجود.", 404);
  return NextResponse.json({ album });
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  coverImageId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى التحقق من البيانات المدخلة.");

  const album = await prisma.album.update({ where: { id }, data: parsed.data });

  await logAudit({
    adminId: auth.admin.id,
    action: "UPDATE",
    entity: "ALBUM",
    entityId: id,
    entityName: album.title,
  });

  return NextResponse.json({ album });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const album = await prisma.album.delete({ where: { id } });

  await logAudit({
    adminId: auth.admin.id,
    action: "DELETE",
    entity: "ALBUM",
    entityId: id,
    entityName: album.title,
  });

  return NextResponse.json({ ok: true });
}
