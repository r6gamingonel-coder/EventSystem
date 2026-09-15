"use client";

import { useMemo, useState } from "react";
import { Check, X, Archive, Trash2, Eye } from "lucide-react";
import { formatArabicDate } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { cn } from "@/lib/cn";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

type JoinRequestRow = {
  id: string;
  fullName: string;
  gender: "MALE" | "FEMALE";
  birthDate: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  area: string;
  occupation: string | null;
  notes: string | null;
  status: Status;
  createdAt: string;
};

const statusLabel: Record<Status, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "مقبول",
  REJECTED: "مرفوض",
  ARCHIVED: "مؤرشف",
};

const statusTone: Record<Status, "gold" | "maroon" | "neutral"> = {
  PENDING: "gold",
  APPROVED: "maroon",
  REJECTED: "neutral",
  ARCHIVED: "neutral",
};

function calcAge(birthDate: string): number {
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function JoinRequestsList({ initial }: { initial: JoinRequestRow[] }) {
  const [requests, setRequests] = useState(initial);
  const [filter, setFilter] = useState<Status | "ALL">("PENDING");
  const [selected, setSelected] = useState<JoinRequestRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(
    () => (filter === "ALL" ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );

  async function updateStatus(id: string, status: Status) {
    setRequests(requests.map((r) => (r.id === id ? { ...r, status } : r)));
    setSelected((s) => (s && s.id === id ? { ...s, status } : s));
    await fetch(`/api/admin/join-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/join-requests/${deleteId}`, { method: "DELETE" });
      setRequests(requests.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      setSelected(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["PENDING", "APPROVED", "REJECTED", "ARCHIVED", "ALL"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold",
              filter === f
                ? "border-brand-maroon-700 bg-brand-maroon-700 text-brand-cream-50"
                : "border-brand-line bg-white text-brand-ink hover:bg-brand-cream-100",
            )}
          >
            {f === "ALL" ? "الكل" : statusLabel[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-brand-ink-soft">لا توجد طلبات ضمن هذا التصنيف.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-brand-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-brand-ink">{r.fullName}</p>
                  <p className="text-sm text-brand-ink-soft mt-0.5">
                    {r.area} · {calcAge(r.birthDate)} سنة · {formatArabicDate(new Date(r.createdAt))}
                  </p>
                </div>
                <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className="flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs font-semibold hover:bg-brand-cream-100"
                >
                  <Eye className="h-3.5 w-3.5" /> عرض التفاصيل
                </button>
                {r.status !== "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "APPROVED")}
                    className="flex items-center gap-1.5 rounded-full border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50"
                  >
                    <Check className="h-3.5 w-3.5" /> قبول
                  </button>
                )}
                {r.status !== "REJECTED" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "REJECTED")}
                    className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" /> رفض
                  </button>
                )}
                {r.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "ARCHIVED")}
                    className="flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs font-semibold hover:bg-brand-cream-100"
                  >
                    <Archive className="h-3.5 w-3.5" /> أرشفة
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteId(r.id)}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-brand-maroon-800">{selected.fullName}</h2>
            <dl className="text-sm space-y-2">
              <Row label="الجنس" value={selected.gender === "MALE" ? "ذكر" : "أنثى"} />
              <Row label="العمر" value={`${calcAge(selected.birthDate)} سنة`} />
              <Row label="الهاتف" value={selected.phone} dir="ltr" />
              {selected.whatsapp && <Row label="واتساب" value={selected.whatsapp} dir="ltr" />}
              {selected.email && <Row label="البريد الإلكتروني" value={selected.email} dir="ltr" />}
              <Row label="منطقة السكن" value={selected.area} />
              {selected.occupation && <Row label="الدراسة/العمل" value={selected.occupation} />}
              {selected.notes && <Row label="ملاحظات" value={selected.notes} />}
              <Row label="تاريخ الطلب" value={formatArabicDate(new Date(selected.createdAt))} />
            </dl>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        description="سيتم حذف طلب الانضمام نهائياً."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function Row({ label, value, dir }: { label: string; value: string; dir?: "ltr" }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brand-line/60 pb-2">
      <dt className="text-brand-ink-soft">{label}</dt>
      <dd dir={dir} className="font-semibold text-brand-ink text-end">
        {value}
      </dd>
    </div>
  );
}
