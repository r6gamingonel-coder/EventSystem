// All "today / upcoming / past" logic must be computed against the project's
// timezone, never the visitor's device clock, so results are consistent for
// everyone regardless of where they open the site from (e.g. Instagram on a
// phone set to a different timezone).

export const PROJECT_TIMEZONE = process.env.TIMEZONE ?? "Asia/Baghdad";

/** Returns "YYYY-MM-DD" for a date, evaluated in the project timezone. */
export function dayKeyInProjectTz(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PROJECT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayKey(): string {
  return dayKeyInProjectTz(new Date());
}

export function isSameDayInProjectTz(a: Date, b: Date): boolean {
  return dayKeyInProjectTz(a) === dayKeyInProjectTz(b);
}

export function isToday(date: Date): boolean {
  return isSameDayInProjectTz(date, new Date());
}

export function isPast(date: Date): boolean {
  // A same-day event counts as "today", not "past", even after its start
  // time has elapsed during the day.
  if (isToday(date)) return false;
  return date.getTime() < Date.now();
}

export function isUpcoming(date: Date): boolean {
  return !isToday(date) && date.getTime() > Date.now();
}

const dateFormatter = new Intl.DateTimeFormat("ar", {
  timeZone: PROJECT_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("ar", {
  timeZone: PROJECT_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const weekdayFormatter = new Intl.DateTimeFormat("ar", {
  timeZone: PROJECT_TIMEZONE,
  weekday: "long",
});

export function formatArabicDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatArabicTime(date: Date): string {
  return timeFormatter.format(date);
}

export function formatArabicWeekday(date: Date): string {
  return weekdayFormatter.format(date);
}

/** For populating a `<input type="datetime-local">` with a value in the project timezone. */
export function toDateTimeLocalValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PROJECT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/**
 * Converts a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm"),
 * interpreted as wall-clock time in the project timezone, into the correct
 * UTC instant — independent of the admin's own browser/device timezone.
 */
export function zonedDateTimeLocalToUtc(
  value: string,
  timeZone: string = PROJECT_TIMEZONE,
): Date {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const [hour, minute] = timePart!.split(":").map(Number);
  const guess = new Date(Date.UTC(year!, month! - 1, day!, hour, minute));
  const offset = getTimeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}
