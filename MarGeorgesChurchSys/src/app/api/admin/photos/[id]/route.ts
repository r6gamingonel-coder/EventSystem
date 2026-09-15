import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  albumId: z.string().min(1).optional(),
  caption: z.string().trim().max(200).nullable().optional(),
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
  if (!parsed.success) return jsonError("بيانات غير صالحة.");

  const photo = await prisma.photo.update({ where: { id }, data: parsed.data });

  await logAudit({ adminId: auth.admin.id, action: "UPDATE", entity: "PHOTO", entityId: id });

  return NextResponse.json({ photo });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await prisma.photo.delete({ where: { id } });

  await logAudit({ adminId: auth.admin.id, action: "DELETE", entity: "PHOTO", entityId: id });

  return NextResponse.json({ ok: true });
}
