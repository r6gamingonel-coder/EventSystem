import type { Metadata } from "next";
import { Phone, Mail, MapPin } from "lucide-react";
import { getSiteSettings } from "@/lib/queries";
import { Section } from "@/components/ui/section";
import { InstagramIcon, FacebookIcon } from "@/components/icons/brand-icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تواصل معنا" };

export default async function ContactPage() {
  const settings = await getSiteSettings();

  const items = [
    settings.phone && {
      icon: Phone,
      label: "الهاتف",
      value: settings.phone,
      href: `tel:${settings.phone}`,
    },
    settings.email && {
      icon: Mail,
      label: "البريد الإلكتروني",
      value: settings.email,
      href: `mailto:${settings.email}`,
    },
    settings.address && {
      icon: MapPin,
      label: "العنوان",
      value: settings.address,
      href: settings.mapsUrl ?? undefined,
    },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];

  return (
    <>
      <section className="bg-brand-maroon-900 py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-2xl px-5">
          <span className="text-sm font-semibold text-brand-gold-400">تواصل معنا</span>
          <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-cream-50">
            {settings.brotherhoodName}
          </h1>
          <p className="mt-3 text-brand-gold-300">{settings.churchName}</p>
        </div>
      </section>

      <Section containerClassName="max-w-2xl">
        <div className="space-y-4">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target={item.href?.startsWith("http") ? "_blank" : undefined}
              rel={item.href?.startsWith("http") ? "noopener noreferrer" : undefined}
              className="flex items-center gap-4 rounded-2xl border border-brand-line bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-cream-200 text-brand-maroon-700">
                <item.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-brand-gold-600">
                  {item.label}
                </span>
                <span className="block font-semibold text-brand-ink">{item.value}</span>
              </span>
            </a>
          ))}

          {(settings.instagramUrl || settings.facebookUrl) && (
            <div className="flex items-center gap-3 pt-2">
              {settings.instagramUrl && (
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white p-4 font-semibold text-brand-maroon-800 shadow-sm hover:shadow-md transition-shadow"
                >
                  <InstagramIcon className="h-5 w-5" />
                  تابعنا على Instagram
                </a>
              )}
              {settings.facebookUrl && (
                <a
                  href={settings.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white p-4 font-semibold text-brand-maroon-800 shadow-sm hover:shadow-md transition-shadow"
                >
                  <FacebookIcon className="h-5 w-5" />
                  صفحتنا على Facebook
                </a>
              )}
            </div>
          )}

          {settings.mapsUrl && (
            <div className="overflow-hidden rounded-2xl border border-brand-line aspect-video">
              <iframe
                src={settings.mapsUrl}
                title="الموقع على الخريطة"
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
