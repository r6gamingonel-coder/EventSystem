import { getSiteSettings } from "@/lib/queries";
import { ContactForm } from "@/components/admin/contact-form";

export default async function AdminContactPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-brand-maroon-800 mb-6">معلومات التواصل</h1>
      <ContactForm
        initial={{
          phone: settings.phone ?? "",
          whatsapp: settings.whatsapp ?? "",
          email: settings.email ?? "",
          address: settings.address ?? "",
          instagramUrl: settings.instagramUrl ?? "",
          facebookUrl: settings.facebookUrl ?? "",
          mapsUrl: settings.mapsUrl ?? "",
        }}
      />
    </div>
  );
}
