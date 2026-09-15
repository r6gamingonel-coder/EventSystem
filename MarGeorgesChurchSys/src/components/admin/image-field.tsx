"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { MediaPicker } from "@/components/admin/media-picker";

export function ImageField({
  label,
  imageUrl,
  onChange,
}: {
  label: string;
  imageUrl: string | null;
  onChange: (assetId: string | null, url: string | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-brand-ink">{label}</span>
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-brand-cream-200 border border-brand-line">
          {imageUrl ? (
            <Image src={imageUrl} alt="" fill sizes="128px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-brand-ink-soft">
              <ImagePlus className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-full border border-brand-line px-4 py-2 text-sm font-semibold hover:bg-brand-cream-100"
          >
            اختر من المكتبة
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onChange(null, null)}
              className="flex items-center gap-1 text-sm text-red-700 hover:underline"
            >
              <X className="h-3.5 w-3.5" /> إزالة الصورة
            </button>
          )}
        </div>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => onChange(asset.id, asset.url)}
      />
    </div>
  );
}
