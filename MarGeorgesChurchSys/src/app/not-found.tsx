import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 text-center">
      <div>
        <span className="text-5xl">🕊️</span>
        <h1 className="mt-4 text-2xl font-extrabold text-brand-maroon-800">
          الصفحة غير موجودة
        </h1>
        <p className="mt-2 text-brand-ink-soft">
          يبدو أن هذه الصفحة غير متوفرة أو تم نقلها.
        </p>
        <div className="mt-6">
          <LinkButton href="/">العودة إلى الرئيسية</LinkButton>
        </div>
      </div>
    </div>
  );
}
