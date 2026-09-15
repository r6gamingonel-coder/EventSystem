import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { uniqueSlug } from "@/lib/slug";
import { zonedDateTimeLocalToUtc } from "@/lib/timezone";

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const activities = await prisma.activity.findMany({
    include: { category: true, coverImage: true, _count: { select: { registrations: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ activities });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(3000),
  categoryId: z.string().min(1),
  coverImageId: z.string().nullable().optional(),
  date: z.string().min(1).transform((v) => zonedDateTimeLocalToUtc(v)),
  location: z.string().trim().min(1).max(200),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  featured: z.boolean().default(false),
  registrationEnabled: z.boolean().default(false),
  imageIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى التحقق من البيانات المدخلة.");

  const { imageIds, ...data } = parsed.data;

  const slug = await uniqueSlug(
    data.title,
    async (s) => !!(await prisma.activity.findUnique({ where: { slug: s } })),
  );

  const activity = await prisma.activity.create({
    data: {
      ...data,
      slug,
      images: imageIds?.length
        ? { create: imageIds.map((mediaAssetId, order) => ({ mediaAssetId, order })) }
        : undefined,
    },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "CREATE",
    entity: "ACTIVITY",
    entityId: activity.id,
    entityName: activity.title,
  });

  return NextResponse.json({ activity });
}
