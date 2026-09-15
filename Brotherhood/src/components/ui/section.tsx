import { cn } from "@/lib/cn";
import { Container } from "./container";

export function Section({
  children,
  className,
  containerClassName,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-14 sm:py-20", className)}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "mb-10 sm:mb-14 max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-start",
      )}
    >
      {eyebrow && (
        <span className="inline-block text-sm font-semibold tracking-wide text-brand-gold-600">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-maroon-800">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-brand-ink-soft leading-relaxed">{description}</p>
      )}
    </div>
  );
}
