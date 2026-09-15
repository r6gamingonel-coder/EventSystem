import { Section, SectionHeading } from "@/components/ui/section";
import { LinkButton } from "@/components/ui/button";
import { ActivityCard } from "@/components/activities/activity-card";
import { getUpcomingActivities, getPastActivities } from "@/lib/queries";

export async function UpcomingActivitiesSection() {
  const activities = await getUpcomingActivities(6);

  return (
    <Section className="bg-brand-cream-100/60">
      <SectionHeading eyebrow="ما ينتظرنا" title="القادم لدينا" />
      {activities.length === 0 ? (
        <p className="text-center text-brand-ink-soft">
          لا توجد فعاليات قادمة حالياً.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
      <div className="mt-10 text-center">
        <LinkButton href="/activities" variant="outline">
          كل الفعاليات
        </LinkButton>
      </div>
    </Section>
  );
}

export async function PastActivitiesSection() {
  const activities = await getPastActivities(6);

  if (activities.length === 0) return null;

  return (
    <Section>
      <SectionHeading eyebrow="ذكريات جميلة" title="من نشاطاتنا" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </Section>
  );
}
