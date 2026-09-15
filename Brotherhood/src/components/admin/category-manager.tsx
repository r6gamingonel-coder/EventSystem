"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";

type Category = { id: string; name: string; icon: string | null; isSystem: boolean };

export function CategoryManager({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState(initial);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon: icon || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories([...categories, { ...data.category, isSystem: false }]);
        setName("");
        setIcon("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/categories/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error);
        return;
      }
      setCategories(categories.filter((c) => c.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6">
      <h2 className="font-bold text-brand-maroon-800 mb-4">تصنيفات الفعاليات</h2>
      <ul className="flex flex-wrap gap-2 mb-4">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-cream-100 px-3 py-1.5 text-sm"
          >
            {c.icon} {c.name}
            {!c.isSystem && (
              <button
                type="button"
                onClick={() => setDeleteId(c.id)}
                aria-label={`حذف ${c.name}`}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🎈"
          className="w-16 rounded-xl border border-brand-line px-3 py-2 text-sm text-center"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم تصنيف جديد"
          className="flex-1 min-w-[160px] rounded-xl border border-brand-line px-3 py-2 text-sm"
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={adding}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إضافة
        </Button>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        description={deleteError ?? "سيتم حذف هذا التصنيف نهائياً."}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteId(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
