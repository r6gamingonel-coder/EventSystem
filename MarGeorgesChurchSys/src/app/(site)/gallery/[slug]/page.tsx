import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAlbumBySlug } from "@/lib/queries";
import { Section } from "@/components/ui/section";
import { MasonryGallery } from "@/components/gallery/lightbox";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/gallery/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  return album ? { title: album.title, description: album.description ?? undefined } : {};
}

export default async function AlbumPage({ params }: PageProps<"/gallery/[slug]">) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) notFound();

  return (
    <>
      <section className="bg-brand-maroon-900 py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-2xl px-5">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-cream-50">
            {album.title}
          </h1>
          {album.description && (
            <p className="mt-3 text-brand-gold-300">{album.description}</p>
          )}
        </div>
      </section>

      <Section containerClassName="max-w-6xl">
        {album.photos.length === 0 ? (
          <p className="text-center text-brand-ink-soft">
            سيتم نشر صور نشاطاتنا قريباً ❤️
          </p>
        ) : (
          <MasonryGallery
            photos={album.photos.map((p) => ({
              id: p.id,
              url: p.mediaAsset.url,
              caption: p.caption,
            }))}
          />
        )}
      </Section>
    </>
  );
}
