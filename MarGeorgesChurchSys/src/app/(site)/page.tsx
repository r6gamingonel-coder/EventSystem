import { getSiteSettings, getStoryPage } from "@/lib/queries";

// "Today's activity" depends on the current moment and admin-edited content,
// so this page must never be served from a stale static/build-time snapshot.
export const dynamic = "force-dynamic";
import { Hero } from "@/components/site/hero";
import { TodaySection } from "@/components/site/today-section";
import { StoryPreview } from "@/components/site/story-preview";
import {
  UpcomingActivitiesSection,
  PastActivitiesSection,
} from "@/components/site/activities-preview";
import { GalleryPreviewSection } from "@/components/site/gallery-preview";
import { JoinSection } from "@/components/site/join-section";

export default async function HomePage() {
  const [settings, story] = await Promise.all([getSiteSettings(), getStoryPage()]);

  return (
    <>
      <Hero
        imageUrl={settings.heroImage?.url ?? null}
        imageBlur={settings.heroImage?.blurDataUrl ?? null}
        title={settings.heroTitle}
        subtitle={settings.heroSubtitle}
        primaryLabel={settings.heroPrimaryLabel}
        primaryHref={settings.heroPrimaryHref}
        secondaryLabel={settings.heroSecondaryLabel}
        secondaryHref={settings.heroSecondaryHref}
      />
      <TodaySection />
      <StoryPreview
        text={settings.storyPreviewText}
        imageUrl={story.image?.url ?? null}
        imageBlur={story.image?.blurDataUrl ?? null}
      />
      <UpcomingActivitiesSection />
      <PastActivitiesSection />
      <GalleryPreviewSection />
      <JoinSection title={settings.joinTitle} description={settings.joinDescription} />
    </>
  );
}
