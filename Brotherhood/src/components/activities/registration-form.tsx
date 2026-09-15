"use client";

import { useState, type FormEvent } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none";

export function RegistrationForm({ slug }: { slug: string }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/activities/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, whatsapp, partySize, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
        setState("error");
        return;
      }
      setState("success");
    } catch {
      setError("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
        <p className="mt-2 font-bold text-green-800">تم تسجيلك بنجاح ❤️</p>
        <p className="mt-1 text-sm text-green-700">نراكم في الفعالية بإذن الله.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" required>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="رقم الهاتف" required>
          <input
            required
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="واتساب (اختياري)">
          <input
            dir="ltr"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="عدد الأشخاص">
          <input
            type="number"
            min={1}
            max={20}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="ملاحظات (اختياري)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={state === "loading"} className="w-full sm:w-auto">
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        تسجيل الحضور
      </Button>

    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-brand-ink">
        {label} {required && <span className="text-brand-maroon-700">*</span>}
      </span>
      {children}
    </label>
  );
}
