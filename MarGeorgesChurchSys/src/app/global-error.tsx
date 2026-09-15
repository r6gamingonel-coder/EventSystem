"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-[#fbf7f0] px-5 text-center font-sans">
        <div>
          <h1 className="text-2xl font-extrabold text-[#5a1524]">حدث خطأ غير متوقع</h1>
          <p className="mt-2 text-[#5c4d44]">يرجى المحاولة مرة أخرى.</p>
          <button
            onClick={reset}
            className="mt-6 rounded-full bg-[#7a1f2e] px-5 py-2.5 text-sm font-semibold text-white"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
