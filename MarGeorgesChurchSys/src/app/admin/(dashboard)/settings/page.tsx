import { getSiteSettings } from "@/lib/queries";
import { IdentityForm } from "@/components/admin/identity-form";
import { PasswordForm } from "@/components/admin/password-form";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-brand-maroon-800">الإعدادات</h1>
      <IdentityForm
        initial={{ brotherhoodName: settings.brotherhoodName, churchName: settings.churchName }}
      />
      <PasswordForm />
    </div>
  );
}
