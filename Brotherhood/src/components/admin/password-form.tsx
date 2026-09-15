"use client";

import { useState, type FormEvent } from "react";
import { SaveBar } from "@/components/admin/save-bar";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/admin/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setState("error");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-4">
      <h2 className="font-bold text-brand-maroon-800">تغيير كلمة المرور</h2>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-brand-ink">كلمة المرور الحالية</span>
        <input
          type="password"
          required
          className={inputClass}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-brand-ink">كلمة المرور الجديدة</span>
        <input
          type="password"
          required
          minLength={8}
          className={inputClass}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </label>
      <SaveBar state={state} error={error} label="تحديث كلمة المرور" />
    </form>
  );
}
