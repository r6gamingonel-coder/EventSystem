"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

type LightboxPhoto = {
  id: string;
  url: string;
  caption: string | null;
};

export function MasonryGallery({ photos }: { photos: LightboxPhoto[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);
  const showPrev = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length)),
    [photos.length],
  );
  const showNext = useCallback(
    () => setActiveIndex((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") showPrev(); // RTL: right = previous
      if (e.key === "ArrowLeft") showNext();
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeIndex, close, showPrev, showNext]);

  return (
    <>
      <div className="columns-2 sm:columns-3 gap-3 sm:gap-4 [column-fill:_balance]">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="mb-3 sm:mb-4 block w-full overflow-hidden rounded-xl bg-brand-cream-200 break-inside-avoid focus-visible:outline-2 focus-visible:outline-brand-gold-600"
          >
            <Image
              src={photo.url}
              alt={photo.caption ?? ""}
              width={500}
              height={500}
              sizes="(min-width: 640px) 33vw, 50vw"
              className="h-auto w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
        >
          <button
            type="button"
            aria-label="إغلاق"
            onClick={close}
            className="absolute top-4 left-4 sm:left-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            type="button"
            aria-label="السابق"
            onClick={(e) => {
              e.stopPropagation();
              showPrev();
            }}
            className="absolute right-2 sm:right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-7 w-7" />
          </button>

          <button
            type="button"
            aria-label="التالي"
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            className="absolute left-2 sm:left-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>

          <div
            className="relative h-[80vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[activeIndex]!.url}
              alt={photos[activeIndex]!.caption ?? ""}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
