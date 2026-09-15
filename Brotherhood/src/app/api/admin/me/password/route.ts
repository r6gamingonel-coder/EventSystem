import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
  }

  const valid = await verifyPassword(parsed.data.currentPassword, auth.admin.passwordHash);
  if (!valid) return jsonError("كلمة المرور الحالية غير صحيحة.", 401);

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.admin.update({ where: { id: auth.admin.id }, data: { passwordHash } });

  await logAudit({
    adminId: auth.admin.id,
    action: "UPDATE",
    entity: "ADMIN",
    entityId: auth.admin.id,
    entityName: auth.admin.name,
    metadata: { self: true, field: "password" },
  });

  return NextResponse.json({ ok: true });
}
