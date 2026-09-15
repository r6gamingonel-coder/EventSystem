import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const storySchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  intro: z.string().trim().max(400).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  imageId: z.string().nullable().optional(),
  showTimeline: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = storySchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى التحقق من البيانات المدخلة.");

  const story = await prisma.storyPage.upsert({
    where: { id: "main" },
    update: parsed.data,
    create: { id: "main", ...parsed.data },
  });

  await logAudit({ adminId: auth.admin.id, action: "UPDATE", entity: "STORY", entityId: "main" });

  return NextResponse.json({ story });
}
