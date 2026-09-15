import { prisma } from "@/lib/prisma";
import { AlbumsManager } from "@/components/admin/albums-manager";

export default async function AdminPhotosPage() {
  const albums = await prisma.album.findMany({
    include: { coverImage: true, _count: { select: { photos: true } } },
    orderBy: { order: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">صور الأخوية</h1>
      <AlbumsManager initial={albums} />
    </div>
  );
}
