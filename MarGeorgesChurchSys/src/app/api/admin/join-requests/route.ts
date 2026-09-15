import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guard";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const requests = await prisma.joinRequest.findMany({
    where:
      status && ["PENDING", "APPROVED", "REJECTED", "ARCHIVED"].includes(status)
        ? { status: status as "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED" }
        : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
