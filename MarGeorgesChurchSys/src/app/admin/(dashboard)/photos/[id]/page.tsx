import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AlbumDetail } from "@/components/admin/album-detail";

export default async function AdminAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [album, otherAlbums] = await Promise.all([
    prisma.album.findUnique({
      where: { id },
      include: { photos: { include: { mediaAsset: true }, orderBy: { order: "asc" } } },
    }),
    prisma.album.findMany({ where: { id: { not: id } }, select: { id: true, title: true } }),
  ]);

  if (!album) notFound();

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">{album.title}</h1>
      <AlbumDetail
        albumId={album.id}
        initialTitle={album.title}
        initialDescription={album.description ?? ""}
        initialPhotos={album.photos.map((p) => ({
          id: p.id,
          url: p.mediaAsset.url,
          caption: p.caption,
        }))}
        otherAlbums={otherAlbums}
      />
    </div>
  );
}
