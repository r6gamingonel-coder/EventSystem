import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const admin = await getCurrentAdmin();
  if (admin) {
    await logAudit({
      adminId: admin.id,
      action: "LOGOUT",
      entity: "ADMIN",
      entityId: admin.id,
      entityName: admin.name,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
