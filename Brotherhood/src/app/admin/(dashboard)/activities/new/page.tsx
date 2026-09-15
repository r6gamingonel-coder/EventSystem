import { prisma } from "@/lib/prisma";
import { toDateTimeLocalValue } from "@/lib/timezone";
import { ActivityForm } from "@/components/admin/activity-form";

export default async function NewActivityPage() {
  const categories = await prisma.activityCategory.findMany({ orderBy: { order: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">إضافة فعالية</h1>
      <ActivityForm
        mode="create"
        categories={categories}
        initial={{
          title: "",
          description: "",
          categoryId: categories[0]?.id ?? "",
          coverImageId: null,
          coverImageUrl: null,
          date: toDateTimeLocalValue(new Date()),
          location: "كنيسة مار كوركيس الكلدانية",
          status: "DRAFT",
          featured: false,
          registrationEnabled: false,
          images: [],
        }}
      />
    </div>
  );
}
