"use client";

import { useEffect, useState } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/brand-icons";

export function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    // Client-only capability check — deliberately not computed during
    // render, so server and first client render match (no `navigator` on
    // the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled — no-op
      }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`;

  return (
    <div className="flex items-center gap-2">
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label="مشاركة"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-line hover:bg-brand-cream-100"
        >
          <Share2 className="h-4.5 w-4.5" />
        </button>
      )}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="مشاركة عبر واتساب"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-line hover:bg-brand-cream-100 text-green-700"
      >
        <WhatsAppIcon className="h-4.5 w-4.5" />
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="نسخ الرابط"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-line hover:bg-brand-cream-100"
      >
        {copied ? <Check className="h-4.5 w-4.5 text-green-700" /> : <LinkIcon className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
}
