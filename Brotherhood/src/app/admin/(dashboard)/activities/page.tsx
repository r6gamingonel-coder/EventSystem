import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/admin/category-manager";
import { ActivitiesList } from "@/components/admin/activities-list";

export default async function AdminActivitiesPage() {
  const [activities, categories] = await Promise.all([
    prisma.activity.findMany({
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    prisma.activityCategory.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-maroon-800">الفعاليات</h1>
        <Link
          href="/admin/activities/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-maroon-700 px-4 py-2.5 text-sm font-semibold text-brand-cream-50"
        >
          <Plus className="h-4 w-4" /> إضافة فعالية
        </Link>
      </div>

      <CategoryManager initial={categories} />

      <ActivitiesList
        initial={activities.map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          date: a.date.toISOString(),
          status: a.status,
          featured: a.featured,
          category: { name: a.category.name, icon: a.category.icon },
        }))}
      />
    </div>
  );
}
