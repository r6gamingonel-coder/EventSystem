import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (id === auth.admin.id) {
    return jsonError("لا يمكنك تعديل صلاحياتك الخاصة من هنا.");
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("بيانات غير صالحة.");

  const admin = await prisma.admin.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "UPDATE",
    entity: "ADMIN",
    entityId: id,
    entityName: admin.name,
  });

  return NextResponse.json({ admin });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (id === auth.admin.id) {
    return jsonError("لا يمكنك حذف حسابك الخاص.");
  }

  const admin = await prisma.admin.delete({ where: { id } });

  await logAudit({
    adminId: auth.admin.id,
    action: "DELETE",
    entity: "ADMIN",
    entityId: id,
    entityName: admin.name,
  });

  return NextResponse.json({ ok: true });
}
