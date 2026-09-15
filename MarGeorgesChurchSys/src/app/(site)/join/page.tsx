import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/queries";
import { Section } from "@/components/ui/section";
import { JoinForm } from "@/components/site/join-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "انضم إلينا" };

export default async function JoinPage() {
  const settings = await getSiteSettings();

  return (
    <>
      <section className="bg-brand-maroon-900 py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-2xl px-5">
          <span className="text-sm font-semibold text-brand-gold-400">انضم إلينا</span>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-cream-50">
            {settings.joinTitle}
          </h1>
          <p className="mt-4 text-brand-gold-300 leading-relaxed">{settings.joinDescription}</p>
        </div>
      </section>

      <Section>
        <JoinForm />
      </Section>
    </>
  );
}
