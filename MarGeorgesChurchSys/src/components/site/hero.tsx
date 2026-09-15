import Image from "next/image";
import { LinkButton } from "@/components/ui/button";

export function Hero({
  imageUrl,
  imageBlur,
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  imageUrl: string | null;
  imageBlur: string | null;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
}) {
  return (
    <section className="relative overflow-hidden bg-brand-maroon-900 min-h-[86vh] sm:min-h-[92vh] flex items-center">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-45"
          placeholder={imageBlur ? "blur" : "empty"}
          blurDataURL={imageBlur ?? undefined}
        />
      ) : (
        <div className="absolute inset-0 path-glow" aria-hidden />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-brand-maroon-900 via-brand-maroon-900/70 to-brand-maroon-900/30"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-4xl px-5 sm:px-6 py-24 text-center">
        <span className="inline-block h-px w-16 bg-brand-gold-400 mb-6" aria-hidden />
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-brand-cream-50 leading-tight text-balance">
          {title}
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-brand-gold-300 font-medium text-balance">
          {subtitle}
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <LinkButton href={primaryHref} size="lg" variant="secondary">
            {primaryLabel}
          </LinkButton>
          <LinkButton
            href={secondaryHref}
            size="lg"
            variant="outline"
            className="border-brand-cream-50/40 text-brand-cream-50 hover:bg-brand-cream-50/10"
          >
            {secondaryLabel}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
