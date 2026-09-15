import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, jsonError } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ARCHIVED"]).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const actionToAudit = {
  APPROVED: "APPROVE",
  REJECTED: "REJECT",
  ARCHIVED: "ARCHIVE",
  PENDING: "UPDATE",
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("بيانات غير صالحة.");

  const joinRequest = await prisma.joinRequest.update({ where: { id }, data: parsed.data });

  await logAudit({
    adminId: auth.admin.id,
    action: parsed.data.status ? actionToAudit[parsed.data.status] : "UPDATE",
    entity: "JOIN_REQUEST",
    entityId: id,
    entityName: joinRequest.fullName,
  });

  return NextResponse.json({ joinRequest });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const joinRequest = await prisma.joinRequest.delete({ where: { id } });

  await logAudit({
    adminId: auth.admin.id,
    action: "DELETE",
    entity: "JOIN_REQUEST",
    entityId: id,
    entityName: joinRequest.fullName,
  });

  return NextResponse.json({ ok: true });
}
