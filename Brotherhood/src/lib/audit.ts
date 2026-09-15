import { prisma } from "@/lib/prisma";
import type { AuditAction, AuditEntity, Prisma } from "@prisma/client";

export async function logAudit(params: {
  adminId: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  entityName?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      entityName: params.entityName,
      metadata: params.metadata,
    },
  });
}
