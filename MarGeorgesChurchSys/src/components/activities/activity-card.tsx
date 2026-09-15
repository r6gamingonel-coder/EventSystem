import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import {
  formatArabicDate,
  formatArabicTime,
  formatArabicWeekday,
  isToday,
} from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";

type ActivityCardData = {
  slug: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  featured: boolean;
  category: { name: string; icon: string | null };
  coverImage: { url: string; blurDataUrl: string | null } | null;
};

export function ActivityCard({
  activity,
  size = "md",
}: {
  activity: ActivityCardData;
  size?: "md" | "lg";
}) {
  const today = isToday(activity.date);

  return (
    <Link
      href={`/activities/${activity.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:shadow-md"
    >
      <div
        className={`relative w-full overflow-hidden bg-brand-cream-200 ${
          size === "lg" ? "aspect-[16/10]" : "aspect-[4/3]"
        }`}
      >
        {activity.coverImage ? (
          <Image
            src={activity.coverImage.url}
            alt={activity.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            placeholder={activity.coverImage.blurDataUrl ? "blur" : "empty"}
            blurDataURL={activity.coverImage.blurDataUrl ?? undefined}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {activity.category.icon ?? "✨"}
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          {today && <Badge tone="maroon">اليوم</Badge>}
          {activity.featured && <Badge tone="gold">مميّزة</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <span className="text-xs font-semibold text-brand-gold-600">
          {activity.category.icon} {activity.category.name}
        </span>
        <h3 className="mt-1 text-lg font-bold text-brand-maroon-800 line-clamp-2">
          {activity.title}
        </h3>
        <p className="mt-1.5 text-sm text-brand-ink-soft line-clamp-2 flex-1">
          {activity.description}
        </p>

        <div className="mt-4 flex flex-col gap-1.5 text-sm text-brand-ink-soft border-t border-brand-line pt-3">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand-maroon-600" />
            {today ? "اليوم" : formatArabicWeekday(activity.date)} —{" "}
            {formatArabicDate(activity.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0 text-brand-maroon-600" />
            {formatArabicTime(activity.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0 text-brand-maroon-600" />
            <span className="line-clamp-1">{activity.location}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
