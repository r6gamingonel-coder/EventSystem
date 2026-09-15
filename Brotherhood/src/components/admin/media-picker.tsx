"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, Loader2, Check, Search, X } from "lucide-react";

type MediaAsset = {
  id: string;
  url: string;
  alt: string | null;
};

export function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAssets(q = "") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/media${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      setAssets(data.assets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) loadAssets();
  }, [open]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAssets((prev) => [data.asset, ...prev]);
      }
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] sm:h-[80vh] w-full sm:max-w-3xl flex-col rounded-t-3xl sm:rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-brand-line p-4">
          <h2 className="font-bold text-brand-maroon-800">مكتبة الوسائط</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-cream-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-brand-line p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadAssets(query)}
              placeholder="بحث..."
              className="w-full rounded-full border border-brand-line py-2 pe-9 ps-4 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-full bg-brand-maroon-700 px-4 py-2 text-sm font-semibold text-brand-cream-50 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            رفع صورة
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-maroon-600" />
            </div>
          ) : assets.length === 0 ? (
            <p className="text-center text-brand-ink-soft py-10">لا توجد صور بعد.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onSelect(asset);
                    onClose();
                  }}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-brand-cream-200 focus-visible:outline-2 focus-visible:outline-brand-gold-600"
                >
                  <Image src={asset.url} alt={asset.alt ?? ""} fill sizes="200px" className="object-cover" />
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
                    <Check className="h-6 w-6 text-white" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
