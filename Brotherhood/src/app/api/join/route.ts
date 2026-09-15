import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const joinSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: z.enum(["MALE", "FEMALE"]),
  birthDate: z.coerce.date(),
  phone: z.string().trim().min(6).max(30),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  area: z.string().trim().min(2).max(120),
  occupation: z.string().trim().max(150).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const { success } = rateLimit(`join:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!success) {
    return NextResponse.json(
      { error: "تم إرسال عدة طلبات من هذا الجهاز. يرجى المحاولة لاحقاً." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "يرجى التحقق من البيانات المدخلة." },
      { status: 400 },
    );
  }

  const { fullName, gender, birthDate, phone, whatsapp, email, area, occupation, notes } =
    parsed.data;

  await prisma.joinRequest.create({
    data: {
      fullName,
      gender,
      birthDate,
      phone,
      whatsapp: whatsapp || null,
      email: email || null,
      area,
      occupation: occupation || null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ ok: true });
}
