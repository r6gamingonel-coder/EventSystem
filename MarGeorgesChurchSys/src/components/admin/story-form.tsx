"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Trash2, Loader2 } from "lucide-react";
import { ImageField } from "@/components/admin/image-field";
import { SaveBar } from "@/components/admin/save-bar";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none";

type Milestone = { id: string; title: string; description: string; isVisible: boolean };

export function StoryForm({
  initial,
}: {
  initial: {
    title: string;
    intro: string;
    content: string;
    imageId: string | null;
    imageUrl: string | null;
    showTimeline: boolean;
    milestones: Milestone[];
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [intro, setIntro] = useState(initial.intro);
  const [content, setContent] = useState(initial.content);
  const [imageId, setImageId] = useState(initial.imageId);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [showTimeline, setShowTimeline] = useState(initial.showTimeline);
  const [milestones, setMilestones] = useState(initial.milestones);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/admin/story", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, intro, content, imageId, showTimeline }),
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
      <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-4">
        <h2 className="font-bold text-brand-maroon-800">محتوى القصة</h2>
        <Field label="العنوان">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="مقدمة قصيرة">
          <textarea rows={2} className={`${inputClass} resize-none`} value={intro} onChange={(e) => setIntro(e.target.value)} />
        </Field>
        <ImageField
          label="صورة القصة"
          imageUrl={imageUrl}
          onChange={(id, url) => {
            setImageId(id);
            setImageUrl(url);
          }}
        />
        <Field label="نص القصة الكامل">
          <textarea rows={10} className={`${inputClass} resize-y`} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <input type="checkbox" checked={showTimeline} onChange={(e) => setShowTimeline(e.target.checked)} className="h-4 w-4" />
          إظهار المحطات الزمنية (Timeline) في صفحة القصة
        </label>
      </div>

      <SaveBar state={state} error={error} />

      <MilestonesEditor milestones={milestones} setMilestones={setMilestones} onChanged={() => router.refresh()} />
    </form>
  );
}

function MilestonesEditor({
  milestones,
  setMilestones,
  onChanged,
}: {
  milestones: Milestone[];
  setMilestones: (m: Milestone[]) => void;
  onChanged: () => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleAdd() {
    if (!newTitle.trim() || !newDescription.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/story/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      const data = await res.json();
      if (res.ok) {
        setMilestones([...milestones, data.milestone]);
        setNewTitle("");
        setNewDescription("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function toggleVisible(id: string, isVisible: boolean) {
    setMilestones(milestones.map((m) => (m.id === id ? { ...m, isVisible } : m)));
    await fetch(`/api/admin/story/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible }),
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/story/milestones/${deleteId}`, { method: "DELETE" });
      setMilestones(milestones.filter((m) => m.id !== deleteId));
      setDeleteId(null);
      onChanged();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-4">
      <h2 className="font-bold text-brand-maroon-800">محطات المسيرة (Timeline)</h2>

      <ul className="space-y-3">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-start gap-3 rounded-xl border border-brand-line p-4">
            <div className="flex-1">
              <p className="font-semibold text-brand-ink">{m.title}</p>
              <p className="text-sm text-brand-ink-soft mt-0.5">{m.description}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleVisible(m.id, !m.isVisible)}
              title={m.isVisible ? "إخفاء" : "إظهار"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-brand-cream-100"
            >
              {m.isVisible ? <Eye className="h-4.5 w-4.5" /> : <EyeOff className="h-4.5 w-4.5 text-brand-ink-soft" />}
            </button>
            <button
              type="button"
              onClick={() => setDeleteId(m.id)}
              title="حذف"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] items-end border-t border-brand-line pt-4">
        <input placeholder="عنوان المرحلة" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={inputClass} />
        <input placeholder="الوصف" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className={inputClass} />
        <Button type="button" onClick={handleAdd} disabled={adding} size="sm">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إضافة
        </Button>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        description="سيتم حذف هذه المرحلة نهائياً من قصة الأخوية."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
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
