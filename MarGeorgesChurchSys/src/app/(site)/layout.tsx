import { getSiteSettings } from "@/lib/queries";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <>
      <SiteHeader brotherhoodName={settings.brotherhoodName} />
      <main className="flex-1">{children}</main>
      <SiteFooter
        brotherhoodName={settings.brotherhoodName}
        churchName={settings.churchName}
        footerText={settings.footerText}
        phone={settings.phone}
        email={settings.email}
        address={settings.address}
        instagramUrl={settings.instagramUrl}
        facebookUrl={settings.facebookUrl}
      />
    </>
  );
}
