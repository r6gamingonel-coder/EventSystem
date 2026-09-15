import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const { success } = rateLimit(`login:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!success) {
    return NextResponse.json(
      { error: "محاولات كثيرة جداً. يرجى المحاولة لاحقاً." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { email } });

  // Constant-shape response whether the admin exists or not, to avoid
  // leaking which emails are registered.
  const isValid =
    admin && admin.isActive ? await verifyPassword(password, admin.passwordHash) : false;

  if (!admin || !isValid) {
    return NextResponse.json(
      { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
      { status: 401 },
    );
  }

  const token = await createSessionToken({ adminId: admin.id, role: admin.role });
  await setSessionCookie(token);

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  await logAudit({
    adminId: admin.id,
    action: "LOGIN",
    entity: "ADMIN",
    entityId: admin.id,
    entityName: admin.name,
  });

  return NextResponse.json({ ok: true });
}
