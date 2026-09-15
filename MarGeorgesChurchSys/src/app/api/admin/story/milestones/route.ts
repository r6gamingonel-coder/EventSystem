import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى التحقق من البيانات المدخلة.");

  await prisma.storyPage.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });

  const maxOrder = await prisma.storyMilestone.aggregate({
    where: { storyId: "main" },
    _max: { order: true },
  });

  const milestone = await prisma.storyMilestone.create({
    data: {
      storyId: "main",
      title: parsed.data.title,
      description: parsed.data.description,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "CREATE",
    entity: "STORY",
    entityId: milestone.id,
    entityName: milestone.title,
  });

  return NextResponse.json({ milestone });
}

const reorderSchema = z.object({ orderedIds: z.array(z.string()) });

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return jsonError("بيانات غير صالحة.");

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.storyMilestone.update({ where: { id }, data: { order: index } }),
    ),
  );

  return NextResponse.json({ ok: true });
}
