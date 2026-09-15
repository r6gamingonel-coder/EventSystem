"use client";

import { useState, type FormEvent } from "react";
import { SaveBar } from "@/components/admin/save-bar";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none";

export function IdentityForm({
  initial,
}: {
  initial: { brotherhoodName: string; churchName: string };
}) {
  const [brotherhoodName, setBrotherhoodName] = useState(initial.brotherhoodName);
  const [churchName, setChurchName] = useState(initial.churchName);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brotherhoodName, churchName }),
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
      <h2 className="font-bold text-brand-maroon-800">الهوية</h2>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-brand-ink">اسم الأخوية</span>
        <input className={inputClass} value={brotherhoodName} onChange={(e) => setBrotherhoodName(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-brand-ink">اسم الكنيسة</span>
        <input className={inputClass} value={churchName} onChange={(e) => setChurchName(e.target.value)} />
      </label>
      <SaveBar state={state} error={error} />
    </form>
  );
}
