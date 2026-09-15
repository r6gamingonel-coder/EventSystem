"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Star } from "lucide-react";
import { formatArabicDate, formatArabicTime } from "@/lib/timezone";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Badge } from "@/components/ui/badge";

type ActivityRow = {
  id: string;
  title: string;
  slug: string;
  date: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featured: boolean;
  category: { name: string; icon: string | null };
};

const statusLabel: Record<ActivityRow["status"], string> = {
  DRAFT: "مسودة",
  PUBLISHED: "منشورة",
  ARCHIVED: "مؤرشفة",
};

const statusTone: Record<ActivityRow["status"], "neutral" | "maroon" | "gold"> = {
  DRAFT: "neutral",
  PUBLISHED: "maroon",
  ARCHIVED: "gold",
};

export function ActivitiesList({ initial }: { initial: ActivityRow[] }) {
  const router = useRouter();
  const [activities, setActivities] = useState(initial);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/activities/${deleteId}`, { method: "DELETE" });
      setActivities(activities.filter((a) => a.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (activities.length === 0) {
    return <p className="text-brand-ink-soft">لا توجد فعاليات بعد. أضف أول فعالية.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-brand-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-line text-start text-brand-ink-soft">
              <th className="p-4 text-start font-semibold">الفعالية</th>
              <th className="p-4 text-start font-semibold">التصنيف</th>
              <th className="p-4 text-start font-semibold">التاريخ</th>
              <th className="p-4 text-start font-semibold">الحالة</th>
              <th className="p-4 text-start font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id} className="border-b border-brand-line last:border-0">
                <td className="p-4 font-semibold text-brand-ink">
                  <span className="flex items-center gap-1.5">
                    {a.featured && <Star className="h-3.5 w-3.5 fill-brand-gold-500 text-brand-gold-500" />}
                    {a.title}
                  </span>
                </td>
                <td className="p-4 text-brand-ink-soft">
                  {a.category.icon} {a.category.name}
                </td>
                <td className="p-4 text-brand-ink-soft whitespace-nowrap">
                  {formatArabicDate(new Date(a.date))} — {formatArabicTime(new Date(a.date))}
                </td>
                <td className="p-4">
                  <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/admin/activities/${a.id}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-cream-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteId(a.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {activities.map((a) => (
          <div key={a.id} className="rounded-2xl border border-brand-line bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-brand-ink flex items-center gap-1.5">
                {a.featured && <Star className="h-3.5 w-3.5 fill-brand-gold-500 text-brand-gold-500" />}
                {a.title}
              </span>
              <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-brand-ink-soft">
              {a.category.icon} {a.category.name} · {formatArabicDate(new Date(a.date))}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Link
                href={`/admin/activities/${a.id}`}
                className="flex-1 rounded-full border border-brand-line py-2 text-center text-sm font-semibold"
              >
                تعديل
              </Link>
              <button
                type="button"
                onClick={() => setDeleteId(a.id)}
                className="flex-1 rounded-full border border-red-200 py-2 text-center text-sm font-semibold text-red-700"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        description="سيتم حذف هذه الفعالية نهائياً من الموقع."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
