"use client";

import { useState, type FormEvent } from "react";
import { Loader2, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none bg-white";

export function JoinForm() {
  const [values, setValues] = useState({
    fullName: "",
    gender: "MALE",
    birthDate: "",
    phone: "",
    whatsapp: "",
    email: "",
    area: "",
    occupation: "",
    notes: "",
  });
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
      <div className="mx-auto max-w-lg rounded-3xl border border-brand-gold-400/40 bg-brand-gold-300/20 p-10 text-center">
        <HeartHandshake className="mx-auto h-10 w-10 text-brand-maroon-700" />
        <h2 className="mt-4 text-xl font-extrabold text-brand-maroon-800">شكراً لك ❤️</h2>
        <p className="mt-2 text-brand-ink-soft leading-relaxed">
          تم استلام طلب انضمامك إلى أخوية طريق المحبة. وسيتم التواصل معك بعد مراجعة الطلب.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" required>
          <input
            required
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="الجنس" required>
          <select
            value={values.gender}
            onChange={(e) => update("gender", e.target.value)}
            className={inputClass}
          >
            <option value="MALE">ذكر</option>
            <option value="FEMALE">أنثى</option>
          </select>
        </Field>

        <Field label="تاريخ الميلاد" required>
          <input
            required
            type="date"
            value={values.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="منطقة السكن" required>
          <input
            required
            value={values.area}
            onChange={(e) => update("area", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="رقم الهاتف" required>
          <input
            required
            dir="ltr"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="واتساب (اختياري)">
          <input
            dir="ltr"
            value={values.whatsapp}
            onChange={(e) => update("whatsapp", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="البريد الإلكتروني (اختياري)">
          <input
            dir="ltr"
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="الدراسة / العمل (اختياري)">
          <input
            value={values.occupation}
            onChange={(e) => update("occupation", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="ملاحظات أو سبب الانضمام (اختياري)">
        <textarea
          rows={4}
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={state === "loading"} size="lg" className="w-full">
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        إرسال الطلب
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
