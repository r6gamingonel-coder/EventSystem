"use client";

import { useState, type FormEvent } from "react";
import { ImageField } from "@/components/admin/image-field";
import { SaveBar } from "@/components/admin/save-bar";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none";

type Settings = {
  heroImageId: string | null;
  heroImageUrl: string | null;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryLabel: string;
  heroPrimaryHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  storyPreviewText: string;
  joinTitle: string;
  joinDescription: string;
  footerText: string;
};

export function HomeContentForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroImageId: values.heroImageId,
          heroTitle: values.heroTitle,
          heroSubtitle: values.heroSubtitle,
          heroPrimaryLabel: values.heroPrimaryLabel,
          heroPrimaryHref: values.heroPrimaryHref,
          heroSecondaryLabel: values.heroSecondaryLabel,
          heroSecondaryHref: values.heroSecondaryHref,
          storyPreviewText: values.storyPreviewText,
          joinTitle: values.joinTitle,
          joinDescription: values.joinDescription,
          footerText: values.footerText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setState("error");
        return;
      }
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section title="القسم الرئيسي (Hero)">
        <ImageField
          label="صورة الخلفية"
          imageUrl={values.heroImageUrl}
          onChange={(id, url) => {
            update("heroImageId", id);
            update("heroImageUrl", url);
          }}
        />
        <Field label="العنوان الرئيسي">
          <input className={inputClass} value={values.heroTitle} onChange={(e) => update("heroTitle", e.target.value)} />
        </Field>
        <Field label="العبارة الفرعية">
          <input className={inputClass} value={values.heroSubtitle} onChange={(e) => update("heroSubtitle", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نص الزر الأول">
            <input className={inputClass} value={values.heroPrimaryLabel} onChange={(e) => update("heroPrimaryLabel", e.target.value)} />
          </Field>
          <Field label="رابط الزر الأول">
            <input dir="ltr" className={inputClass} value={values.heroPrimaryHref} onChange={(e) => update("heroPrimaryHref", e.target.value)} />
          </Field>
          <Field label="نص الزر الثاني">
            <input className={inputClass} value={values.heroSecondaryLabel} onChange={(e) => update("heroSecondaryLabel", e.target.value)} />
          </Field>
          <Field label="رابط الزر الثاني">
            <input dir="ltr" className={inputClass} value={values.heroSecondaryHref} onChange={(e) => update("heroSecondaryHref", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="مقدمة قصتنا (تظهر في الرئيسية)">
        <Field label="النص">
          <textarea rows={3} className={`${inputClass} resize-none`} value={values.storyPreviewText} onChange={(e) => update("storyPreviewText", e.target.value)} />
        </Field>
      </Section>

      <Section title="قسم الانضمام">
        <Field label="العنوان">
          <input className={inputClass} value={values.joinTitle} onChange={(e) => update("joinTitle", e.target.value)} />
        </Field>
        <Field label="الوصف">
          <textarea rows={2} className={`${inputClass} resize-none`} value={values.joinDescription} onChange={(e) => update("joinDescription", e.target.value)} />
        </Field>
      </Section>

      <Section title="التذييل (Footer)">
        <Field label="نص التذييل">
          <textarea rows={2} className={`${inputClass} resize-none`} value={values.footerText} onChange={(e) => update("footerText", e.target.value)} />
        </Field>
      </Section>

      <SaveBar state={state} error={error} />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-4">
      <h2 className="font-bold text-brand-maroon-800">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-brand-ink">{label}</span>
      {children}
    </label>
  );
}
