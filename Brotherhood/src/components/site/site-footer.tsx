import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { InstagramIcon, FacebookIcon } from "@/components/icons/brand-icons";

export function SiteFooter({
  brotherhoodName,
  churchName,
  footerText,
  phone,
  email,
  address,
  instagramUrl,
  facebookUrl,
}: {
  brotherhoodName: string;
  churchName: string;
  footerText?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
}) {
  return (
    <footer className="mt-auto border-t border-brand-line/70 bg-brand-maroon-900 text-brand-cream-100">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8 py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-brand-cream-50">{brotherhoodName}</p>
          <p className="mt-1 text-sm text-brand-gold-300">{churchName}</p>
          {footerText && (
            <p className="mt-4 text-sm leading-relaxed text-brand-cream-100/80">
              {footerText}
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-bold text-brand-cream-50 mb-3">روابط سريعة</p>
          <ul className="space-y-2 text-sm text-brand-cream-100/80">
            <li>
              <Link href="/story" className="hover:text-brand-gold-300">
                قصتنا
              </Link>
            </li>
            <li>
              <Link href="/activities" className="hover:text-brand-gold-300">
                الفعاليات
              </Link>
            </li>
            <li>
              <Link href="/gallery" className="hover:text-brand-gold-300">
                الصور
              </Link>
            </li>
            <li>
              <Link href="/join" className="hover:text-brand-gold-300">
                انضم إلينا
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-brand-cream-50 mb-3">تواصل معنا</p>
          <ul className="space-y-2.5 text-sm text-brand-cream-100/80">
            {phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-brand-gold-400" />
                <a dir="ltr" href={`tel:${phone}`} className="hover:text-brand-gold-300">
                  {phone}
                </a>
              </li>
            )}
            {email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-brand-gold-400" />
                <a href={`mailto:${email}`} className="hover:text-brand-gold-300 break-all">
                  {email}
                </a>
              </li>
            )}
            {address && (
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-brand-gold-400" />
                <span>{address}</span>
              </li>
            )}
          </ul>
          <div className="mt-4 flex items-center gap-3">
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="تابعنا على Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-cream-50/10 hover:bg-brand-gold-500 hover:text-brand-maroon-900 transition-colors"
              >
                <InstagramIcon className="h-5 w-5" />
              </a>
            )}
            {facebookUrl && (
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="صفحتنا على Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-cream-50/10 hover:bg-brand-gold-500 hover:text-brand-maroon-900 transition-colors"
              >
                <FacebookIcon className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-brand-cream-50/10 py-5 text-center text-xs text-brand-cream-100/60">
        © {new Date().getFullYear()} {brotherhoodName} — {churchName}
      </div>
    </footer>
  );
}
