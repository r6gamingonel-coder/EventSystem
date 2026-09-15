"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Cross } from "lucide-react";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/story", label: "قصتنا" },
  { href: "/activities", label: "الفعاليات" },
  { href: "/gallery", label: "الصور" },
  { href: "/contact", label: "تواصل معنا" },
];

export function SiteHeader({ brotherhoodName }: { brotherhoodName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-brand-line/70 bg-brand-cream-50/90 backdrop-blur supports-[backdrop-filter]:bg-brand-cream-50/75">
      <div className="mx-auto flex h-16 sm:h-18 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-maroon-700 text-brand-cream-50">
            <Cross className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
          <span className="text-base sm:text-lg font-extrabold text-brand-maroon-800 leading-tight">
            {brotherhoodName}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                pathname === link.href
                  ? "bg-brand-maroon-700 text-brand-cream-50"
                  : "text-brand-ink hover:bg-brand-cream-200",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <LinkButton href="/join" size="sm">
            انضم إلينا
          </LinkButton>
        </div>

        <button
          type="button"
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-maroon-800 hover:bg-brand-cream-200"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-brand-line/70 bg-brand-cream-50 px-5 py-4">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-xl px-4 py-3 text-base font-semibold",
                    pathname === link.href
                      ? "bg-brand-maroon-700 text-brand-cream-50"
                      : "text-brand-ink hover:bg-brand-cream-200",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <LinkButton href="/join" className="w-full" onClick={() => setOpen(false)}>
                انضم إلينا
              </LinkButton>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
