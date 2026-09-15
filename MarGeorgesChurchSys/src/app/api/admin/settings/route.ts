import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const settingsSchema = z.object({
  brotherhoodName: z.string().trim().min(1).max(150).optional(),
  churchName: z.string().trim().min(1).max(150).optional(),
  heroImageId: z.string().nullable().optional(),
  heroTitle: z.string().trim().min(1).max(150).optional(),
  heroSubtitle: z.string().trim().min(1).max(200).optional(),
  heroPrimaryLabel: z.string().trim().min(1).max(60).optional(),
  heroPrimaryHref: z.string().trim().min(1).max(200).optional(),
  heroSecondaryLabel: z.string().trim().min(1).max(60).optional(),
  heroSecondaryHref: z.string().trim().min(1).max(200).optional(),
  storyPreviewText: z.string().trim().max(600).optional(),
  joinTitle: z.string().trim().min(1).max(150).optional(),
  joinDescription: z.string().trim().max(400).optional(),
  footerText: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  whatsapp: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().max(150).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  instagramUrl: z.string().trim().max(300).nullable().optional(),
  facebookUrl: z.string().trim().max(300).nullable().optional(),
  mapsUrl: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return jsonError("يرجى التحقق من البيانات المدخلة.");

  const settings = await prisma.siteSettings.upsert({
    where: { id: "main" },
    update: parsed.data,
    create: { id: "main", ...parsed.data },
  });

  await logAudit({
    adminId: auth.admin.id,
    action: "UPDATE",
    entity: "SETTINGS",
    entityId: "main",
  });

  return NextResponse.json({ settings });
}
