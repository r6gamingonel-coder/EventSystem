import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi, jsonError } from "@/lib/api-guard";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ admins });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).default("ADMIN"),
});

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى التحقق من البيانات المدخلة.");

  const existing = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  if (existing) return jsonError("هذا البريد الإلكتروني مستخدم بالفعل.");

  const passwordHash = await hashPassword(parsed.data.password);
  const admin = await prisma.admin.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "CREATE",
    entity: "ADMIN",
    entityId: admin.id,
    entityName: admin.name,
  });

  return NextResponse.json({ admin });
}
