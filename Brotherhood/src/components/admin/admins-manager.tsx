"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, ShieldCheck, Shield } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN";
  isActive: boolean;
};

const inputClass = "w-full rounded-xl border border-brand-line px-3 py-2 text-sm";

export function AdminsManager({ initial, selfId }: { initial: AdminRow[]; selfId: string }) {
  const [admins, setAdmins] = useState(initial);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ADMIN" as const });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setAdmins([...admins, { ...data.admin, isActive: true }]);
      setForm({ name: "", email: "", password: "", role: "ADMIN" });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(admin: AdminRow) {
    setAdmins(admins.map((a) => (a.id === admin.id ? { ...a, isActive: !a.isActive } : a)));
    await fetch(`/api/admin/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !admin.isActive }),
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/admins/${deleteId}`, { method: "DELETE" });
      setAdmins(admins.filter((a) => a.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6">
        <h2 className="font-bold text-brand-maroon-800 mb-4">إضافة مشرف جديد</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="الاسم"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="البريد الإلكتروني"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
          />
          <input
            placeholder="كلمة المرور المبدئية"
            type="password"
            dir="ltr"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={inputClass}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" })}
            className={inputClass}
          >
            <option value="ADMIN">مشرف</option>
            <option value="SUPER_ADMIN">مدير النظام الرئيسي</option>
          </select>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
        <Button type="button" onClick={handleCreate} disabled={creating} className="mt-4">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إضافة مشرف
        </Button>
      </div>

      <div className="space-y-3">
        {admins.map((admin) => (
          <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line bg-white p-4">
            <div className="flex items-center gap-3">
              {admin.role === "SUPER_ADMIN" ? (
                <ShieldCheck className="h-5 w-5 text-brand-gold-600" />
              ) : (
                <Shield className="h-5 w-5 text-brand-ink-soft" />
              )}
              <div>
                <p className="font-semibold text-brand-ink">
                  {admin.name} {admin.id === selfId && <span className="text-xs text-brand-ink-soft">(أنت)</span>}
                </p>
                <p className="text-xs text-brand-ink-soft" dir="ltr">
                  {admin.email}
                </p>
              </div>
            </div>
            {admin.id !== selfId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(admin)}
                  className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-semibold hover:bg-brand-cream-100"
                >
                  {admin.isActive ? "تعطيل" : "تفعيل"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(admin.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        description="سيتم حذف حساب هذا المشرف نهائياً."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
