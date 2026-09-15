"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageField } from "@/components/admin/image-field";
import { MultiImageField, type PickedImage } from "@/components/admin/multi-image-field";
import { SaveBar } from "@/components/admin/save-bar";

const inputClass =
  "w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600 focus:outline-none";

type Category = { id: string; name: string; icon: string | null };

export function ActivityForm({
  mode,
  activityId,
  categories,
  initial,
}: {
  mode: "create" | "edit";
  activityId?: string;
  categories: Category[];
  initial: {
    title: string;
    description: string;
    categoryId: string;
    coverImageId: string | null;
    coverImageUrl: string | null;
    date: string; // datetime-local value
    location: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    featured: boolean;
    registrationEnabled: boolean;
    images: PickedImage[];
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [coverImageId, setCoverImageId] = useState(initial.coverImageId);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);
  const [date, setDate] = useState(initial.date);
  const [location, setLocation] = useState(initial.location);
  const [status, setStatus] = useState(initial.status);
  const [featured, setFeatured] = useState(initial.featured);
  const [registrationEnabled, setRegistrationEnabled] = useState(initial.registrationEnabled);
  const [images, setImages] = useState<PickedImage[]>(initial.images);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent, statusOverride?: typeof status) {
    e.preventDefault();
    setState("loading");
    setError(null);

    const payload = {
      title,
      description,
      categoryId,
      coverImageId,
      date,
      location,
      status: statusOverride ?? status,
      featured,
      registrationEnabled,
      imageIds: images.map((i) => i.id),
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/admin/activities" : `/api/admin/activities/${activityId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setState("error");
        return;
      }
      setState("success");
      if (mode === "create") {
        router.push("/admin/activities");
      } else {
        router.refresh();
      }
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-4">
        <Field label="اسم الفعالية" required>
          <input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="التصنيف" required>
            <select required className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المكان" required>
            <input required className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="التاريخ والوقت" required>
            <input
              required
              type="datetime-local"
              dir="ltr"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>

        <ImageField
          label="الصورة الرئيسية (Cover)"
          imageUrl={coverImageUrl}
          onChange={(id, url) => {
            setCoverImageId(id);
            setCoverImageUrl(url);
          }}
        />

        <Field label="الوصف" required>
          <textarea
            required
            rows={6}
            className={`${inputClass} resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <MultiImageField label="صور إضافية" images={images} onChange={setImages} />
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <input type="checkbox" className="h-4 w-4" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          فعالية مميّزة (Featured)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={registrationEnabled}
            onChange={(e) => setRegistrationEnabled(e.target.checked)}
          />
          تفعيل التسجيل لهذه الفعالية
        </label>

        <Field label="حالة النشر">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="DRAFT">مسودة (Draft)</option>
            <option value="PUBLISHED">منشورة (Published)</option>
            <option value="ARCHIVED">مؤرشفة (Archived)</option>
          </select>
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <SaveBar
        state={state}
        error={error}
        label={mode === "create" ? "إنشاء الفعالية" : "حفظ التغييرات"}
      />
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
