import { prisma } from "@/lib/prisma";
import { JoinRequestsList } from "@/components/admin/join-requests-list";

export default async function AdminJoinRequestsPage() {
  const requests = await prisma.joinRequest.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">طلبات الانضمام</h1>
      <JoinRequestsList
        initial={requests.map((r) => ({
          id: r.id,
          fullName: r.fullName,
          gender: r.gender,
          birthDate: r.birthDate.toISOString(),
          phone: r.phone,
          whatsapp: r.whatsapp,
          email: r.email,
          area: r.area,
          occupation: r.occupation,
          notes: r.notes,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
