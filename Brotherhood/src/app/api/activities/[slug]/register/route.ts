import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  partySize: z.coerce.number().int().min(1).max(20).default(1),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(request.headers);
  const { success } = rateLimit(`register:${ip}`, { limit: 15, windowMs: 10 * 60 * 1000 });
  if (!success) {
    return NextResponse.json(
      { error: "محاولات كثيرة جداً. يرجى المحاولة لاحقاً." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "يرجى التحقق من البيانات المدخلة." },
      { status: 400 },
    );
  }

  const activity = await prisma.activity.findFirst({
    where: { slug, status: "PUBLISHED", registrationEnabled: true },
  });
  if (!activity) {
    return NextResponse.json({ error: "التسجيل غير متاح لهذه الفعالية." }, { status: 404 });
  }

  const { fullName, phone, whatsapp, partySize, notes } = parsed.data;

  await prisma.eventRegistration.create({
    data: {
      activityId: activity.id,
      fullName,
      phone,
      whatsapp: whatsapp || null,
      partySize,
      notes: notes || null,
    },
  });

  return NextResponse.json({ ok: true });
}
