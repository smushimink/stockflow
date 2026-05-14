"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

// ── Password strength ─────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score, label: "Weak", color: "#C54632" };
  if (score === 3) return { score, label: "Fair", color: "#B47214" };
  return { score, label: "Strong", color: "#3E7A2E" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const passwordValue = watch("password", "");
  const strength = passwordStrength(passwordValue);

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();

    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    // If session is immediately available (email confirmation disabled), redirect
    if (result.session) {
      if (planParam) {
        const res = await fetch("/api/stripe/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planKey: planParam }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.url) { window.location.href = json.url; return; }
          if (json.redirect) { window.location.href = json.redirect; return; }
        }
      }
      window.location.href = "/onboarding";
      return;
    }

    // Email confirmation is required — show confirmation state
    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F2F8F0] border border-[#3E7A2E]/20 flex items-center justify-center mx-auto">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4 4 8-8" stroke="#3E7A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A17]">Check your email</h1>
            <p className="mt-2 text-sm text-[#6B6B66]">
              We sent a confirmation link to your inbox. Click it to activate your account.
            </p>
          </div>
          <p className="text-xs text-[#6B6B66]">
            Wrong email?{" "}
            <button
              onClick={() => setEmailSent(false)}
              className="underline hover:text-[#1A1A17]"
            >
              Go back
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A17]">Start for $1 / month</h1>
          <p className="mt-1 text-sm text-[#6B6B66]">$1 for your first month. Cancel anytime.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-[#FDF2F0] border border-[#C54632]/20 px-3 py-2.5 text-sm text-[#C54632]">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              autoFocus
              {...register("email")}
              className="bg-white border-[#E5E5E2]"
            />
            {errors.email && (
              <p className="text-xs text-[#C54632]">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              {...register("password")}
              className="bg-white border-[#E5E5E2]"
            />
            {/* Strength indicator */}
            {passwordValue.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors"
                      style={{
                        background: i <= strength.score ? strength.color : "#E5E5E2",
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: strength.color }}>
                  {strength.label}
                </p>
              </div>
            )}
            {errors.password && (
              <p className="text-xs text-[#C54632]">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className="bg-white border-[#E5E5E2]"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-[#C54632]">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-[#1A1A17] text-white hover:bg-[#2D2D29]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account…" : "Get started — $1 first month"}
          </Button>
        </form>

        {/* Footer links */}
        <div className="space-y-3 text-center">
          <p className="text-xs text-[#6B6B66]">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-[#1A1A17]">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-[#6B6B66]">
            Prefer a magic link?{" "}
            <Link href="/login?tab=magic" className="underline hover:text-[#1A1A17]">
              Sign in without a password
            </Link>
          </p>
        </div>

        {/* TODO: Enable email confirmation in production after setting up custom SMTP */}
      </div>
    </div>
  );
}
