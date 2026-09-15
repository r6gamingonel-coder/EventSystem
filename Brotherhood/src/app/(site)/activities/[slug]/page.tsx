import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { getActivityBySlug } from "@/lib/queries";
import { formatArabicDate, formatArabicTime, formatArabicWeekday, isToday } from "@/lib/timezone";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { ShareButtons } from "@/components/site/share-buttons";
import { RegistrationForm } from "@/components/activities/registration-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/activities/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const activity = await getActivityBySlug(slug);
  if (!activity) return {};
  return { title: activity.title, description: activity.description };
}

export default async function ActivityDetailPage({
  params,
}: PageProps<"/activities/[slug]">) {
  const { slug } = await params;
  const activity = await getActivityBySlug(slug);
  if (!activity) notFound();

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/activities/${activity.slug}`;
  const today = isToday(activity.date);

  return (
    <>
      <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-brand-cream-200">
        {activity.coverImage ? (
          <Image
            src={activity.coverImage.url}
            alt={activity.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            placeholder={activity.coverImage.blurDataUrl ? "blur" : "empty"}
            blurDataURL={activity.coverImage.blurDataUrl ?? undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">
            {activity.category.icon ?? "✨"}
          </div>
        )}
      </div>

      <Section containerClassName="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge tone="gold">
            {activity.category.icon} {activity.category.name}
          </Badge>
          {today && <Badge tone="maroon">اليوم</Badge>}
          {activity.featured && <Badge tone="neutral">فعالية مميّزة</Badge>}
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-maroon-800">
            {activity.title}
          </h1>
          <ShareButtons title={activity.title} url={url} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3 rounded-2xl border border-brand-line bg-brand-cream-100/60 p-5">
          <span className="flex items-center gap-2 text-sm text-brand-ink-soft">
            <CalendarDays className="h-4.5 w-4.5 text-brand-maroon-600" />
            {today ? "اليوم" : formatArabicWeekday(activity.date)} —{" "}
            {formatArabicDate(activity.date)}
          </span>
          <span className="flex items-center gap-2 text-sm text-brand-ink-soft">
            <Clock className="h-4.5 w-4.5 text-brand-maroon-600" />
            {formatArabicTime(activity.date)}
          </span>
          <span className="flex items-center gap-2 text-sm text-brand-ink-soft">
            <MapPin className="h-4.5 w-4.5 text-brand-maroon-600" />
            {activity.location}
          </span>
        </div>

        <p className="mt-8 leading-loose text-brand-ink-soft whitespace-pre-line">
          {activity.description}
        </p>

        {activity.images.length > 0 && (
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {activity.images.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square overflow-hidden rounded-xl bg-brand-cream-200"
              >
                <Image
                  src={img.mediaAsset.url}
                  alt={activity.title}
                  fill
                  sizes="33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {activity.registrationEnabled && (
          <div className="mt-12 rounded-2xl border border-brand-line bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-brand-maroon-800 mb-4">
              سجّل حضورك
            </h2>
            <RegistrationForm slug={activity.slug} />
          </div>
        )}
      </Section>
    </>
  );
}
