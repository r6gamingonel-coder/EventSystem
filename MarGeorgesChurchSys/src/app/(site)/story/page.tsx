import type { Metadata } from "next";
import Image from "next/image";
import { getStoryPage, getSiteSettings } from "@/lib/queries";
import { Section, SectionHeading } from "@/components/ui/section";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "قصتنا" };

export default async function StoryPage() {
  const [story, settings] = await Promise.all([getStoryPage(), getSiteSettings()]);

  return (
    <>
      <section className="relative overflow-hidden bg-brand-maroon-900 py-20 sm:py-28 text-center">
        <div className="absolute inset-0 path-glow" aria-hidden />
        <div className="relative mx-auto max-w-2xl px-5">
          <span className="text-sm font-semibold text-brand-gold-400">قصتنا</span>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-cream-50">
            {story.title}
          </h1>
          <p className="mt-4 text-brand-gold-300 leading-relaxed">{story.intro}</p>
        </div>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-brand-cream-200">
            {story.image ? (
              <Image
                src={story.image.url}
                alt={story.title}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
                placeholder={story.image.blurDataUrl ? "blur" : "empty"}
                blurDataURL={story.image.blurDataUrl ?? undefined}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl">✝️</div>
            )}
          </div>
          <div className="prose-none">
            <p className="text-brand-ink-soft leading-loose whitespace-pre-line text-[15px] sm:text-base">
              {story.content}
            </p>
            <p className="mt-6 text-sm font-semibold text-brand-gold-600">
              {settings.brotherhoodName} — {settings.churchName}
            </p>
          </div>
        </div>
      </Section>

      {story.showTimeline && story.milestones.length > 0 && (
        <Section className="bg-brand-cream-100/60">
          <SectionHeading eyebrow="مسيرتنا" title="محطات على الطريق" />
          <ol className="relative mx-auto max-w-2xl">
            <div
              className="absolute top-0 bottom-0 right-4 sm:right-1/2 w-px bg-brand-gold-400/50 sm:translate-x-1/2"
              aria-hidden
            />
            {story.milestones.map((milestone, i) => (
              <li key={milestone.id} className="relative pr-12 sm:pr-0 pb-10 last:pb-0">
                <div
                  className="absolute right-4 sm:right-1/2 top-1 h-3 w-3 -translate-x-1/2 sm:translate-x-1/2 rounded-full bg-brand-maroon-700 ring-4 ring-brand-cream-100"
                  aria-hidden
                />
                <div
                  className={`sm:w-[calc(50%-2rem)] ${
                    i % 2 === 0 ? "sm:me-auto sm:text-end" : "sm:ms-auto"
                  }`}
                >
                  <div className="rounded-2xl bg-white border border-brand-line p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-brand-maroon-800">
                      {milestone.title}
                    </h3>
                    <p className="mt-2 text-sm text-brand-ink-soft leading-relaxed">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}
