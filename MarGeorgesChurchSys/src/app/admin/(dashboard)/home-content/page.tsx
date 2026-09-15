import { getSiteSettings } from "@/lib/queries";
import { HomeContentForm } from "@/components/admin/home-content-form";

export default async function AdminHomeContentPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">محتوى الصفحة الرئيسية</h1>
      <HomeContentForm
        initial={{
          heroImageId: settings.heroImageId,
          heroImageUrl: settings.heroImage?.url ?? null,
          heroTitle: settings.heroTitle,
          heroSubtitle: settings.heroSubtitle,
          heroPrimaryLabel: settings.heroPrimaryLabel,
          heroPrimaryHref: settings.heroPrimaryHref,
          heroSecondaryLabel: settings.heroSecondaryLabel,
          heroSecondaryHref: settings.heroSecondaryHref,
          storyPreviewText: settings.storyPreviewText ?? "",
          joinTitle: settings.joinTitle,
          joinDescription: settings.joinDescription,
          footerText: settings.footerText ?? "",
        }}
      />
    </div>
  );
}
