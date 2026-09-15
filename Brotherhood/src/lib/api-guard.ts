import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import type { Admin } from "@prisma/client";

export const GENERIC_ERROR = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";

export async function requireAdminApi(): Promise<
  { admin: Admin } | { error: NextResponse }
> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return { error: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) };
  }
  return { admin };
}

export async function requireSuperAdminApi(): Promise<
  { admin: Admin } | { error: NextResponse }
> {
  const result = await requireAdminApi();
  if ("error" in result) return result;
  if (result.admin.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "هذا الإجراء متاح لمدير النظام الرئيسي فقط." },
        { status: 403 },
      ),
    };
  }
  return result;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
