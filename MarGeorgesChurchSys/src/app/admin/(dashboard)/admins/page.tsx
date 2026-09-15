import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { AdminsManager } from "@/components/admin/admins-manager";

export default async function AdminAdminsPage() {
  const me = await getCurrentAdmin();
  if (!me || me.role !== "SUPER_ADMIN") redirect("/admin");

  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">المشرفون</h1>
      <AdminsManager initial={admins} selfId={me.id} />
    </div>
  );
}
