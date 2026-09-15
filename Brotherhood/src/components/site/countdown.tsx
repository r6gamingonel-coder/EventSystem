"use client";

import { useEffect, useState } from "react";

function getParts(targetIso: string) {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return { days, hours, minutes };
}

export function Countdown({ targetIso }: { targetIso: string }) {
  const [parts, setParts] = useState<{ days: number; hours: number; minutes: number } | null>(
    null,
  );

  useEffect(() => {
    // Deliberately set on mount only (not during render) to avoid a
    // server/client hydration mismatch — "now" differs between the two.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParts(getParts(targetIso));
    const id = setInterval(() => setParts(getParts(targetIso)), 60_000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!parts) return null;

  const items = [
    { label: "يوم", value: parts.days },
    { label: "ساعة", value: parts.hours },
    { label: "دقيقة", value: parts.minutes },
  ];

  return (
    <div className="flex items-center gap-3 sm:gap-4" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center justify-center rounded-xl bg-brand-maroon-800 text-brand-cream-50 h-16 w-16 sm:h-20 sm:w-20"
        >
          <span className="text-xl sm:text-2xl font-extrabold tabular-nums">
            {item.value}
          </span>
          <span className="text-[11px] sm:text-xs text-brand-gold-300">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
