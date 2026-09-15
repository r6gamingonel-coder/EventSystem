import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
  tone = "gold",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "gold" | "maroon" | "neutral";
}) {
  const tones = {
    gold: "bg-brand-gold-300/60 text-brand-maroon-900",
    maroon: "bg-brand-maroon-700 text-brand-cream-50",
    neutral: "bg-brand-cream-200 text-brand-ink-soft",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
