import Image from "next/image";
import { Section, SectionHeading } from "@/components/ui/section";
import { LinkButton } from "@/components/ui/button";
import { getGalleryPreviewPhotos } from "@/lib/queries";

export async function GalleryPreviewSection() {
  const photos = await getGalleryPreviewPhotos(8);

  return (
    <Section className="bg-brand-cream-100/60">
      <SectionHeading eyebrow="لحظات نعتز بها" title="صور الأخوية" />
      {photos.length === 0 ? (
        <p className="text-center text-brand-ink-soft">
          سيتم نشر صور نشاطاتنا قريباً ❤️
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className={`relative overflow-hidden rounded-2xl bg-brand-cream-200 ${
                i === 0 ? "col-span-2 row-span-2 aspect-square sm:aspect-square" : "aspect-square"
              }`}
            >
              <Image
                src={photo.mediaAsset.url}
                alt={photo.caption ?? photo.album.title}
                fill
                sizes="(min-width: 640px) 25vw, 50vw"
                className="object-cover"
                placeholder={photo.mediaAsset.blurDataUrl ? "blur" : "empty"}
                blurDataURL={photo.mediaAsset.blurDataUrl ?? undefined}
              />
            </div>
          ))}
        </div>
      )}
      <div className="mt-10 text-center">
        <LinkButton href="/gallery" variant="outline">
          كل الصور
        </LinkButton>
      </div>
    </Section>
  );
}
