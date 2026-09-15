import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getTodayOrNextActivities } from "@/lib/queries";
import { formatArabicDate, formatArabicTime } from "@/lib/timezone";
import { Users, CalendarDays, Images, Clock } from "lucide-react";

export default async function AdminDashboardHome() {
  const [pendingRequests, totalActivities, totalAlbums, recentPhotos, todayResult] =
    await Promise.all([
      prisma.joinRequest.count({ where: { status: "PENDING" } }),
      prisma.activity.count(),
      prisma.album.count(),
      prisma.photo.findMany({
        include: { mediaAsset: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      getTodayOrNextActivities(),
    ]);

  const stats = [
    {
      label: "طلبات انضمام بانتظار المراجعة",
      value: pendingRequests,
      icon: Users,
      href: "/admin/join-requests",
    },
    { label: "إجمالي الفعاليات", value: totalActivities, icon: CalendarDays, href: "/admin/activities" },
    { label: "الألبومات", value: totalAlbums, icon: Images, href: "/admin/photos" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-brand-maroon-800">لوحة التحكم</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <stat.icon className="h-6 w-6 text-brand-maroon-600" />
            <p className="mt-3 text-3xl font-extrabold text-brand-maroon-800">{stat.value}</p>
            <p className="mt-1 text-sm text-brand-ink-soft">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-brand-maroon-600" />
          <h2 className="font-bold text-brand-maroon-800">
            {todayResult.kind === "today" ? "نشاط اليوم" : "الفعالية القادمة"}
          </h2>
        </div>
        {todayResult.activities.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">لا توجد فعاليات منشورة حالياً.</p>
        ) : (
          <ul className="space-y-3">
            {todayResult.activities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-brand-ink">{a.title}</span>
                <span className="text-brand-ink-soft">
                  {formatArabicDate(a.date)} — {formatArabicTime(a.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
        <h2 className="font-bold text-brand-maroon-800 mb-4">آخر الصور المضافة</h2>
        {recentPhotos.length === 0 ? (
          <p className="text-sm text-brand-ink-soft">لم يتم إضافة صور بعد.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {recentPhotos.map((photo) => (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-brand-cream-200">
                <Image src={photo.mediaAsset.url} alt="" fill sizes="100px" className="object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
