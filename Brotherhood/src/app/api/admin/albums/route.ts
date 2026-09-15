import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { uniqueSlug } from "@/lib/slug";

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const albums = await prisma.album.findMany({
    include: { coverImage: true, _count: { select: { photos: true } } },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ albums });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى إدخال اسم الألبوم.");

  const slug = await uniqueSlug(
    parsed.data.title,
    async (s) => !!(await prisma.album.findUnique({ where: { slug: s } })),
  );

  const maxOrder = await prisma.album.aggregate({ _max: { order: true } });

  const album = await prisma.album.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      slug,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "CREATE",
    entity: "ALBUM",
    entityId: album.id,
    entityName: album.title,
  });

  return NextResponse.json({ album });
}
