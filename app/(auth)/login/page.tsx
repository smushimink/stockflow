"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Schemas ───────────────────────────────────────────────────────────────────

const passwordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const magicSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type PasswordForm = z.infer<typeof passwordSchema>;
type MagicForm = z.infer<typeof magicSchema>;

// ── Password tab ──────────────────────────────────────────────────────────────

function PasswordTab() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  async function onSubmit(data: PasswordForm) {
    setServerError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setServerError("Invalid email or password.");
      return;
    }

    // Dashboard layout redirects to /onboarding if no org
    window.location.href = "/today";
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-lg bg-[#FDF2F0] border border-[#C54632]/20 px-3 py-2.5 text-sm text-[#C54632]">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pw-email" className="text-sm font-medium">Email address</Label>
        <Input
          id="pw-email"
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
        <div className="flex items-center justify-between">
          <Label htmlFor="pw-password" className="text-sm font-medium">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-[#6B6B66] hover:text-[#1A1A17] transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="pw-password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          {...register("password")}
          className="bg-white border-[#E5E5E2]"
        />
        {errors.password && (
          <p className="text-xs text-[#C54632]">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#1A1A17] text-white hover:bg-[#2D2D29]"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

// ── Magic link tab ────────────────────────────────────────────────────────────

function MagicTab() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicForm>({ resolver: zodResolver(magicSchema) });

  async function onSubmit(data: MagicForm) {
    setServerError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    setSentEmail(data.email);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="w-10 h-10 rounded-full bg-[#F2F8F0] border border-[#3E7A2E]/20 flex items-center justify-center mx-auto">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M4 10l4 4 8-8" stroke="#3E7A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-[#1A1A17]">Check your inbox</p>
          <p className="mt-1 text-sm text-[#6B6B66]">
            Magic link sent to <span className="font-medium text-[#1A1A17]">{sentEmail}</span>
          </p>
        </div>
        <button
          onClick={() => setSent(false)}
          className="text-xs text-[#6B6B66] underline hover:text-[#1A1A17]"
        >
          Try a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-lg bg-[#FDF2F0] border border-[#C54632]/20 px-3 py-2.5 text-sm text-[#C54632]">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ml-email" className="text-sm font-medium">Email address</Label>
        <Input
          id="ml-email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          {...register("email")}
          className="bg-white border-[#E5E5E2]"
        />
        {errors.email && (
          <p className="text-xs text-[#C54632]">{errors.email.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#1A1A17] text-white hover:bg-[#2D2D29]"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send magic link"}
      </Button>

      <p className="text-xs text-center text-[#6B6B66]">
        No password needed — we&apos;ll email you a secure sign-in link.
      </p>
    </form>
  );
}

// ── Tab detector (reads ?tab= from URL) ───────────────────────────────────────

function LoginTabs() {
  const params = useSearchParams();
  const defaultTab = params.get("tab") === "magic" ? "magic" : "password";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full mb-6">
        <TabsTrigger value="password" className="flex-1 text-sm">
          Email &amp; Password
        </TabsTrigger>
        <TabsTrigger value="magic" className="flex-1 text-sm">
          Magic Link
        </TabsTrigger>
      </TabsList>

      <TabsContent value="password">
        <PasswordTab />
      </TabsContent>
      <TabsContent value="magic">
        <MagicTab />
      </TabsContent>
    </Tabs>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A17]">Sign in</h1>
          <p className="mt-1 text-sm text-[#6B6B66]">Welcome back to ArachNet</p>
        </div>

        <Suspense fallback={<div className="h-32" />}>
          <LoginTabs />
        </Suspense>

        <p className="text-xs text-center text-[#6B6B66]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline hover:text-[#1A1A17]">
            Start for $1
          </Link>
        </p>
      </div>
    </div>
  );
}
