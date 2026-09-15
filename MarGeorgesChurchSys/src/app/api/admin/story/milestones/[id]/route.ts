import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(600).optional(),
  isVisible: z.boolean().optional(),
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

  const milestone = await prisma.storyMilestone.update({ where: { id }, data: parsed.data });

  await logAudit({
    adminId: auth.admin.id,
    action: "UPDATE",
    entity: "STORY",
    entityId: id,
    entityName: milestone.title,
  });

  return NextResponse.json({ milestone });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await prisma.storyMilestone.delete({ where: { id } });

  await logAudit({ adminId: auth.admin.id, action: "DELETE", entity: "STORY", entityId: id });

  return NextResponse.json({ ok: true });
}
