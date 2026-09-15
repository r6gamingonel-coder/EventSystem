import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().max(10).nullable().optional(),
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

  const category = await prisma.activityCategory.update({ where: { id }, data: parsed.data });

  await logAudit({
    adminId: auth.admin.id,
    action: "UPDATE",
    entity: "ACTIVITY_CATEGORY",
    entityId: id,
    entityName: category.name,
  });

  return NextResponse.json({ category });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const category = await prisma.activityCategory.findUnique({
    where: { id },
    include: { _count: { select: { activities: true } } },
  });
  if (!category) return jsonError("التصنيف غير موجود.", 404);
  if (category.isSystem) return jsonError("لا يمكن حذف تصنيف أساسي، يمكنك تعديل اسمه فقط.");
  if (category._count.activities > 0) {
    return jsonError("لا يمكن حذف تصنيف مستخدم في فعاليات حالية.");
  }

  await prisma.activityCategory.delete({ where: { id } });

  await logAudit({
    adminId: auth.admin.id,
    action: "DELETE",
    entity: "ACTIVITY_CATEGORY",
    entityId: id,
    entityName: category.name,
  });

  return NextResponse.json({ ok: true });
}
