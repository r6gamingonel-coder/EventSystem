"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Home,
  BookOpen,
  CalendarDays,
  Images,
  Users,
  Phone,
  Settings,
  ShieldCheck,
  ScrollText,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { href: "/admin/home-content", label: "محتوى الرئيسية", icon: Home },
  { href: "/admin/story", label: "قصتنا", icon: BookOpen },
  { href: "/admin/activities", label: "الفعاليات", icon: CalendarDays },
  { href: "/admin/photos", label: "الصور", icon: Images },
  { href: "/admin/join-requests", label: "طلبات الانضمام", icon: Users },
  { href: "/admin/contact", label: "التواصل", icon: Phone },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
  { href: "/admin/admins", label: "المشرفون", icon: ShieldCheck, superOnly: true },
  { href: "/admin/audit-logs", label: "سجل العمليات", icon: ScrollText },
];

export function AdminSidebar({ isSuperAdmin, adminName }: { isSuperAdmin: boolean; adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const links = LINKS.filter((l) => !l.superOnly || isSuperAdmin);

  const content = (
    <nav className="flex h-full flex-col">
      <div className="p-5 border-b border-brand-line/70">
        <p className="font-extrabold text-brand-maroon-800">لوحة تحكم الأخوية</p>
        <p className="text-xs text-brand-ink-soft mt-0.5">مرحباً، {adminName}</p>
      </div>
      <ul className="flex-1 overflow-y-auto p-3 space-y-1">
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-brand-maroon-700 text-brand-cream-50"
                    : "text-brand-ink hover:bg-brand-cream-100",
                )}
              >
                <link.icon className="h-4.5 w-4.5 shrink-0" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="p-3 border-t border-brand-line/70">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-4.5 w-4.5" />
          تسجيل الخروج
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 border-e border-brand-line/70 bg-white">
        {content}
      </aside>

      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-brand-line/70 bg-white px-4 h-14">
        <span className="font-extrabold text-brand-maroon-800">لوحة التحكم</span>
        <button
          type="button"
          aria-label="فتح القائمة"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-cream-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72 bg-white shadow-xl">
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
              className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-cream-100"
            >
              <X className="h-5 w-5" />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
