"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 text-center">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-maroon-800">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-brand-ink-soft">يرجى المحاولة مرة أخرى.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={reset}>إعادة المحاولة</Button>
          <Link href="/" className="text-sm font-semibold text-brand-maroon-700 hover:underline">
            العودة إلى الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
