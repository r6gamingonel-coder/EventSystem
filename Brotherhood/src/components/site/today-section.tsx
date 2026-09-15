import { CalendarDays, Clock, MapPin, Heart } from "lucide-react";
import { formatArabicDate, formatArabicTime, formatArabicWeekday } from "@/lib/timezone";
import { LinkButton } from "@/components/ui/button";
import { Countdown } from "@/components/site/countdown";
import { getTodayOrNextActivities } from "@/lib/queries";

type Awaited_ = Awaited<ReturnType<typeof getTodayOrNextActivities>>;

export async function TodaySection() {
  const result = await getTodayOrNextActivities();

  if (result.activities.length === 0) {
    return null;
  }

  return (
    <section className="bg-brand-gold-300/25 border-y border-brand-gold-400/40">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="flex items-center gap-2 mb-6 justify-center sm:justify-start">
          <Heart className="h-5 w-5 text-brand-maroon-700 fill-brand-maroon-700" />
          <h2 className="text-xl sm:text-2xl font-extrabold text-brand-maroon-800">
            {result.kind === "today" ? "اليوم في الأخوية" : "أقرب لقاء لنا"}
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.activities.map((activity) => (
            <TodayCard key={activity.id} activity={activity} kind={result.kind} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TodayCard({
  activity,
  kind,
}: {
  activity: Awaited_["activities"][number];
  kind: Awaited_["kind"];
}) {
  return (
    <div className="rounded-2xl bg-white border border-brand-line p-5 sm:p-6 shadow-sm flex flex-col gap-4">
      <div>
        <span className="text-xs font-semibold text-brand-gold-600">
          {activity.category.icon} {activity.category.name}
        </span>
        <h3 className="mt-1 text-lg font-bold text-brand-maroon-800">{activity.title}</h3>
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-brand-ink-soft">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-brand-maroon-600" />
          {kind === "today" ? "اليوم" : formatArabicWeekday(activity.date)} —{" "}
          {formatArabicDate(activity.date)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 shrink-0 text-brand-maroon-600" />
          {formatArabicTime(activity.date)}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-brand-maroon-600" />
          {activity.location}
        </span>
      </div>

      {kind === "next" && <Countdown targetIso={activity.date.toISOString()} />}

      <LinkButton href={`/activities/${activity.slug}`} size="sm" className="mt-auto self-start">
        {activity.registrationEnabled ? "سجّل الآن" : "اعرف المزيد"}
      </LinkButton>
    </div>
  );
}
