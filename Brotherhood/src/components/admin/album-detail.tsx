"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Upload,
  Loader2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Star,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";

type Photo = { id: string; url: string; caption: string | null };
type AlbumOption = { id: string; title: string };

export function AlbumDetail({
  albumId,
  initialTitle,
  initialDescription,
  initialPhotos,
  otherAlbums,
}: {
  albumId: string;
  initialTitle: string;
  initialDescription: string;
  initialPhotos: Photo[];
  otherAlbums: AlbumOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveInfo() {
    setSavingInfo(true);
    try {
      await fetch(`/api/admin/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleUpload(files: FileList) {
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/admin/albums/${albumId}/photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPhotos([...photos, ...data.photos.map((p: { id: string; mediaAsset: { url: string }; caption: string | null }) => ({ id: p.id, url: p.mediaAsset.url, caption: p.caption }))]);
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= photos.length) return;
    const next = [...photos];
    [next[index], next[newIndex]] = [next[newIndex]!, next[index]!];
    setPhotos(next);
    fetch(`/api/admin/albums/${albumId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedPhotoIds: next.map((p) => p.id) }),
    });
  }

  async function setCover(mediaId: string) {
    await fetch(`/api/admin/albums/${albumId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImageId: mediaId }),
    });
    router.refresh();
  }

  async function moveToAlbum(photoId: string, targetAlbumId: string) {
    if (!targetAlbumId) return;
    await fetch(`/api/admin/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: targetAlbumId }),
    });
    setPhotos(photos.filter((p) => p.id !== photoId));
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/photos/${deleteId}`, { method: "DELETE" });
      setPhotos(photos.filter((p) => p.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6 space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-brand-ink">اسم الألبوم</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveInfo}
            className="w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-brand-ink">الوصف</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveInfo}
            className="w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm resize-none"
          />
        </div>
        {savingInfo && <span className="text-xs text-brand-ink-soft">جارِ الحفظ...</span>}
      </div>

      <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-brand-maroon-800">الصور ({photos.length})</h2>
          <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            رفع صور
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {photos.length === 0 ? (
          <p className="text-brand-ink-soft">لا توجد صور في هذا الألبوم بعد.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="rounded-xl border border-brand-line overflow-hidden">
                <div className="relative aspect-square bg-brand-cream-200">
                  <Image src={photo.url} alt="" fill sizes="200px" className="object-cover" />
                </div>
                <div className="flex items-center justify-between gap-1 p-2 bg-brand-cream-50">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-brand-cream-200 disabled:opacity-30"
                    aria-label="نقل للأعلى"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCover(photo.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-brand-cream-200"
                    aria-label="تعيين كغلاف"
                    title="تعيين كغلاف الألبوم"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                  {otherAlbums.length > 0 && (
                    <select
                      onChange={(e) => moveToAlbum(photo.id, e.target.value)}
                      defaultValue=""
                      className="h-7 rounded-md border border-brand-line text-[10px]"
                      title="نقل إلى ألبوم آخر"
                    >
                      <option value="" disabled>
                        نقل إلى...
                      </option>
                      {otherAlbums.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteId(photo.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === photos.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-brand-cream-200 disabled:opacity-30"
                    aria-label="نقل للأسفل"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        description="سيتم حذف هذه الصورة نهائياً من الألبوم."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
