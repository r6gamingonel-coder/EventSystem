"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cross, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
        return;
      }
      const next = searchParams.get("next") ?? "/admin";
      router.push(next);
      router.refresh();
    } catch {
      setError("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream-50 px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-maroon-700 text-brand-cream-50 mb-4">
            <Cross className="h-7 w-7" strokeWidth={2.25} />
          </span>
          <h1 className="text-xl font-extrabold text-brand-maroon-800">
            لوحة تحكم أخوية طريق المحبة
          </h1>
          <p className="mt-1 text-sm text-brand-ink-soft">تسجيل دخول المشرفين</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-brand-line bg-white p-6 shadow-sm space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-brand-ink mb-1.5">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600"
              dir="ltr"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-brand-ink mb-1.5"
            >
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-brand-line px-4 py-2.5 text-sm focus:border-brand-maroon-600"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            دخول
          </Button>
        </form>
      </div>
    </div>
  );
}
