import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toDateTimeLocalValue } from "@/lib/timezone";
import { ActivityForm } from "@/components/admin/activity-form";

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [activity, categories] = await Promise.all([
    prisma.activity.findUnique({
      where: { id },
      include: {
        coverImage: true,
        images: { include: { mediaAsset: true }, orderBy: { order: "asc" } },
      },
    }),
    prisma.activityCategory.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (!activity) notFound();

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">تعديل الفعالية</h1>
      <ActivityForm
        mode="edit"
        activityId={activity.id}
        categories={categories}
        initial={{
          title: activity.title,
          description: activity.description,
          categoryId: activity.categoryId,
          coverImageId: activity.coverImageId,
          coverImageUrl: activity.coverImage?.url ?? null,
          date: toDateTimeLocalValue(activity.date),
          location: activity.location,
          status: activity.status,
          featured: activity.featured,
          registrationEnabled: activity.registrationEnabled,
          images: activity.images.map((i) => ({ id: i.mediaAsset.id, url: i.mediaAsset.url })),
        }}
      />
    </div>
  );
}
