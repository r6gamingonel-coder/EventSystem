import { LinkButton } from "@/components/ui/button";

export function JoinSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="relative overflow-hidden bg-brand-maroon-800 py-16 sm:py-20">
      <div className="absolute inset-0 path-glow opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-2xl px-5 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-cream-50">
          {title}
        </h2>
        <p className="mt-4 text-brand-gold-300 leading-relaxed">{description}</p>
        <LinkButton href="/join" size="lg" variant="secondary" className="mt-8">
          انضم الآن
        </LinkButton>
      </div>
    </section>
  );
}
