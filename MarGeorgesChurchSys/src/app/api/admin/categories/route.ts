import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { uniqueSlug } from "@/lib/slug";

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const categories = await prisma.activityCategory.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { activities: true } } },
  });
  return NextResponse.json({ categories });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(10).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى إدخال اسم التصنيف.");

  const slug = await uniqueSlug(
    parsed.data.name,
    async (s) => !!(await prisma.activityCategory.findUnique({ where: { slug: s } })),
  );

  const maxOrder = await prisma.activityCategory.aggregate({ _max: { order: true } });

  const category = await prisma.activityCategory.create({
    data: {
      name: parsed.data.name,
      icon: parsed.data.icon,
      slug,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "CREATE",
    entity: "ACTIVITY_CATEGORY",
    entityId: category.id,
    entityName: category.name,
  });

  return NextResponse.json({ category });
}
