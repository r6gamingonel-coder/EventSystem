import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublishedAlbums } from "@/lib/queries";
import { Section } from "@/components/ui/section";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "صور الأخوية" };

export default async function GalleryPage() {
  const albums = await getPublishedAlbums();

  return (
    <>
      <section className="bg-brand-maroon-900 py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-2xl px-5">
          <span className="text-sm font-semibold text-brand-gold-400">صور الأخوية</span>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-cream-50">
            لحظات نعتز بها
          </h1>
        </div>
      </section>

      <Section containerClassName="max-w-6xl">
        {albums.length === 0 ? (
          <p className="text-center text-brand-ink-soft">
            سيتم نشر صور نشاطاتنا قريباً ❤️
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/gallery/${album.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-[4/3] bg-brand-cream-200 overflow-hidden">
                  {album.coverImage ? (
                    <Image
                      src={album.coverImage.url}
                      alt={album.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">📷</div>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  <h2 className="text-lg font-bold text-brand-maroon-800">{album.title}</h2>
                  {album.description && (
                    <p className="mt-1 text-sm text-brand-ink-soft line-clamp-2">
                      {album.description}
                    </p>
                  )}
                  <span className="mt-2 inline-block text-xs font-semibold text-brand-gold-600">
                    {album._count.photos} صورة
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
