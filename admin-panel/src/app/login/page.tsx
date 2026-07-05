"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn, BarChart3 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    const success = await login(data.email, data.password);
    if (success) {
      router.replace("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        {/* Logo & Başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--primary)] mb-4">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
            Saha Satış Yönetimi
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Admin Paneli — Antalya Market
          </p>
        </div>

        {/* Kart */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm p-8">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-6">
            Hesabınıza giriş yapın
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* E-posta */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
              >
                E-posta adresi
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ornek@sirket.com"
                {...register("email")}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg border bg-[var(--background)] text-[var(--foreground)]",
                  "text-sm placeholder:text-[var(--muted-foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent",
                  "transition-colors",
                  errors.email
                    ? "border-[var(--destructive)]"
                    : "border-[var(--border)]"
                )}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-[var(--destructive)]">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Şifre */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                  className={cn(
                    "w-full px-3 py-2.5 pr-10 rounded-lg border bg-[var(--background)] text-[var(--foreground)]",
                    "text-sm placeholder:text-[var(--muted-foreground)]",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent",
                    "transition-colors",
                    errors.password
                      ? "border-[var(--destructive)]"
                      : "border-[var(--border)]"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-[var(--destructive)]">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Giriş Butonu */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full flex items-center justify-center gap-2",
                "px-4 py-2.5 rounded-lg",
                "bg-[var(--primary)] text-[var(--primary-foreground)]",
                "text-sm font-medium",
                "hover:opacity-90 transition-opacity",
                "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "mt-2"
              )}
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" aria-hidden="true" />
              )}
              {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--muted-foreground)] mt-6">
          © {new Date().getFullYear()} Antalya Market — Tüm hakları saklıdır
        </p>
      </div>
    </div>
  );
}
