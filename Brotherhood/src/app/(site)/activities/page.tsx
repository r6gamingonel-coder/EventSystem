import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { getActivitiesForListing, getAllCategories } from "@/lib/queries";
import { Section, SectionHeading } from "@/components/ui/section";
import { ActivityCard } from "@/components/activities/activity-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "الفعاليات" };

export default async function ActivitiesPage({
  searchParams,
}: PageProps<"/activities">) {
  const params = await searchParams;
  const categorySlug =
    typeof params.category === "string" ? params.category : undefined;

  const [{ upcoming, past }, categories] = await Promise.all([
    getActivitiesForListing(categorySlug),
    getAllCategories(),
  ]);

  return (
    <>
      <section className="bg-brand-maroon-900 py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-2xl px-5">
          <span className="text-sm font-semibold text-brand-gold-400">فعالياتنا</span>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-cream-50">
            لقاءاتنا ومهرجاناتنا ونشاطاتنا
          </h1>
        </div>
      </section>

      <Section containerClassName="max-w-6xl">
        <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
          <CategoryPill href="/activities" label="الكل" active={!categorySlug} />
          {categories.map((c) => (
            <CategoryPill
              key={c.id}
              href={`/activities?category=${c.slug}`}
              label={`${c.icon ?? ""} ${c.name}`}
              active={categorySlug === c.slug}
            />
          ))}
        </div>

        <SectionHeading title="القادم لدينا" align="start" />
        {upcoming.length === 0 ? (
          <p className="text-brand-ink-soft mb-14">لا توجد فعاليات قادمة حالياً.</p>
        ) : (
          <div className="mb-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        <SectionHeading title="من نشاطاتنا" align="start" />
        {past.length === 0 ? (
          <p className="text-brand-ink-soft">لا توجد نشاطات سابقة بعد.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function CategoryPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "border-brand-maroon-700 bg-brand-maroon-700 text-brand-cream-50"
          : "border-brand-line bg-white text-brand-ink hover:bg-brand-cream-100",
      )}
    >
      {label}
    </Link>
  );
}
