"use client";

import { Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SaveBar({
  state,
  error,
  label = "حفظ التغييرات",
}: {
  state: "idle" | "loading" | "success" | "error";
  error?: string | null;
  label?: string;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-brand-line bg-white px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="text-sm">
        {state === "success" && (
          <span className="flex items-center gap-1.5 text-green-700 font-semibold">
            <Check className="h-4 w-4" /> تم الحفظ بنجاح
          </span>
        )}
        {state === "error" && (
          <span className="flex items-center gap-1.5 text-red-700 font-semibold">
            <AlertCircle className="h-4 w-4" /> {error ?? "حدث خطأ غير متوقع."}
          </span>
        )}
      </div>
      <Button type="submit" disabled={state === "loading"}>
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </Button>
    </div>
  );
}
