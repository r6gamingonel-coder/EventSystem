"use client";

import { useState, type FormEvent } from "react";
import { SaveBar } from "@/components/admin/save-bar";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none";

type Contact = {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  instagramUrl: string;
  facebookUrl: string;
  mapsUrl: string;
};

export function ContactForm({ initial }: { initial: Contact }) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Contact>(key: K, value: Contact[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم الهاتف">
          <input dir="ltr" className={inputClass} value={values.phone} onChange={(e) => update("phone", e.target.value)} />
        </Field>
        <Field label="رقم واتساب">
          <input dir="ltr" className={inputClass} value={values.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
        </Field>
        <Field label="البريد الإلكتروني">
          <input dir="ltr" className={inputClass} value={values.email} onChange={(e) => update("email", e.target.value)} />
        </Field>
        <Field label="العنوان">
          <input className={inputClass} value={values.address} onChange={(e) => update("address", e.target.value)} />
        </Field>
        <Field label="رابط Instagram">
          <input dir="ltr" className={inputClass} value={values.instagramUrl} onChange={(e) => update("instagramUrl", e.target.value)} />
        </Field>
        <Field label="رابط Facebook">
          <input dir="ltr" className={inputClass} value={values.facebookUrl} onChange={(e) => update("facebookUrl", e.target.value)} />
        </Field>
      </div>
      <Field label="رابط خرائط Google (embed)">
        <input dir="ltr" className={inputClass} value={values.mapsUrl} onChange={(e) => update("mapsUrl", e.target.value)} />
      </Field>

      <SaveBar state={state} error={error} />
    </form>
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
