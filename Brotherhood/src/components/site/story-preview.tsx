import Image from "next/image";
import { Section, SectionHeading } from "@/components/ui/section";
import { LinkButton } from "@/components/ui/button";

export function StoryPreview({
  text,
  imageUrl,
  imageBlur,
}: {
  text: string | null;
  imageUrl: string | null;
  imageBlur: string | null;
}) {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-2 items-center">
        <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-brand-cream-200 order-2 lg:order-1">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="قصة أخوية طريق المحبة"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              placeholder={imageBlur ? "blur" : "empty"}
              blurDataURL={imageBlur ?? undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">✝️</div>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <SectionHeading eyebrow="قصتنا" title="طريق بدأ بالمحبة" align="start" />
          <p className="text-brand-ink-soft leading-relaxed">{text}</p>
          <LinkButton href="/story" variant="outline" className="mt-6">
            اقرأ قصتنا كاملة
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}
