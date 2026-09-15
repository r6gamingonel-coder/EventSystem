import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { zonedDateTimeLocalToUtc } from "@/lib/timezone";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      coverImage: true,
      images: { include: { mediaAsset: true }, orderBy: { order: "asc" } },
    },
  });
  if (!activity) return jsonError("الفعالية غير موجودة.", 404);
  return NextResponse.json({ activity });
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().min(1).max(3000).optional(),
  categoryId: z.string().min(1).optional(),
  coverImageId: z.string().nullable().optional(),
  date: z
    .string()
    .min(1)
    .transform((v) => zonedDateTimeLocalToUtc(v))
    .optional(),
  location: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  featured: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  imageIds: z.array(z.string()).optional(),
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
  if (!parsed.success) return jsonError("يرجى التحقق من البيانات المدخلة.");

  const { imageIds, ...data } = parsed.data;

  const activity = await prisma.activity.update({
    where: { id },
    data: {
      ...data,
      ...(imageIds
        ? {
            images: {
              deleteMany: {},
              create: imageIds.map((mediaAssetId, order) => ({ mediaAssetId, order })),
            },
          }
        : {}),
    },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "UPDATE",
    entity: "ACTIVITY",
    entityId: id,
    entityName: activity.title,
  });

  return NextResponse.json({ activity });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const activity = await prisma.activity.delete({ where: { id } });

  await logAudit({
    adminId: auth.admin.id,
    action: "DELETE",
    entity: "ACTIVITY",
    entityId: id,
    entityName: activity.title,
  });

  return NextResponse.json({ ok: true });
}
