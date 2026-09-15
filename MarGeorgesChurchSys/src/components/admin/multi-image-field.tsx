"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { MediaPicker } from "@/components/admin/media-picker";

export type PickedImage = { id: string; url: string };

export function MultiImageField({
  label,
  images,
  onChange,
}: {
  label: string;
  images: PickedImage[];
  onChange: (images: PickedImage[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-brand-ink">{label}</span>
      <div className="flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-brand-line">
            <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((i) => i.id !== img.id))}
              aria-label="إزالة"
              className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-brand-line text-brand-ink-soft hover:bg-brand-cream-100"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          if (!images.some((i) => i.id === asset.id)) {
            onChange([...images, { id: asset.id, url: asset.url }]);
          }
        }}
      />
    </div>
  );
}
