"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";

type Album = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  coverImage: { url: string } | null;
  _count: { photos: number };
};

export function AlbumsManager({ initial }: { initial: Album[] }) {
  const [albums, setAlbums] = useState(initial);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlbums([...albums, { ...data.album, coverImage: null, _count: { photos: 0 } }]);
        setTitle("");
      }
    } finally {
      setCreating(false);
    }
  }

  async function togglePublish(album: Album) {
    const nextStatus = album.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setAlbums(albums.map((a) => (a.id === album.id ? { ...a, status: nextStatus } : a)));
    await fetch(`/api/admin/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/albums/${deleteId}`, { method: "DELETE" });
      setAlbums(albums.filter((a) => a.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-line bg-white p-5 sm:p-6">
        <h2 className="font-bold text-brand-maroon-800 mb-3">إنشاء ألبوم جديد</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="اسم الألبوم (مثال: رحلة الأخوية 2026)"
            className="flex-1 min-w-[220px] rounded-xl border border-brand-line px-4 py-2.5 text-sm"
          />
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            إنشاء
          </Button>
        </div>
      </div>

      {albums.length === 0 ? (
        <p className="text-brand-ink-soft">لا توجد ألبومات بعد.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <div key={album.id} className="rounded-2xl border border-brand-line bg-white overflow-hidden">
              <Link href={`/admin/photos/${album.id}`} className="block relative aspect-[4/3] bg-brand-cream-200">
                {album.coverImage ? (
                  <Image src={album.coverImage.url} alt="" fill sizes="300px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">📷</div>
                )}
              </Link>
              <div className="p-4">
                <Link href={`/admin/photos/${album.id}`} className="font-bold text-brand-ink hover:text-brand-maroon-700">
                  {album.title}
                </Link>
                <p className="text-xs text-brand-ink-soft mt-1">{album._count.photos} صورة</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePublish(album)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-brand-line py-1.5 text-xs font-semibold hover:bg-brand-cream-100"
                  >
                    {album.status === "PUBLISHED" ? (
                      <>
                        <Eye className="h-3.5 w-3.5" /> منشور
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> مخفي
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(album.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        description="سيتم حذف هذا الألبوم وجميع صوره نهائياً."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
