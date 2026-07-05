"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, BarChart3 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Geçerli e-posta girin"),
  password: z.string().min(6, "En az 6 karakter"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    clearError();
    const ok = await login(data.email, data.password);
    if (ok) router.replace("/home");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-6">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-[var(--primary)] items-center justify-center mb-4 shadow-lg">
          <BarChart3 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">SFA Saha</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Hesabınıza giriş yapın</p>
      </div>

      {/* Form kartı */}
      <div className="w-full max-w-sm bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 shadow-sm">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="ornek@firma.com"
              {...register("email")}
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-[var(--background)] text-[var(--foreground)] text-base",
                "placeholder:text-[var(--muted-foreground)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                errors.email ? "border-[var(--destructive)]" : "border-[var(--border)]"
              )}
            />
            {errors.email && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Şifre
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                className={cn(
                  "w-full px-4 py-3 pr-12 rounded-xl border bg-[var(--background)] text-[var(--foreground)] text-base",
                  "placeholder:text-[var(--muted-foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                  errors.password ? "border-[var(--destructive)]" : "border-[var(--border)]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-[var(--destructive)]">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "w-full py-3.5 rounded-xl bg-[var(--primary)] text-white font-semibold text-base",
              "flex items-center justify-center gap-2",
              "active:scale-[0.98] transition-transform",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "mt-2"
            )}
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : null}
            {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
