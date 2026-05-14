"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ password: data.password });

    if (error) {
      setServerError(error.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F2F8F0] border border-[#3E7A2E]/20 flex items-center justify-center mx-auto">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4 4 8-8" stroke="#3E7A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A17]">Password updated</h1>
            <p className="mt-2 text-sm text-[#6B6B66]">
              Your password has been changed. You can now sign in with your new password.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block px-4 py-2 text-sm font-medium rounded-lg bg-[#1A1A17] text-white hover:bg-[#2D2D29] transition-colors"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A17]">Set new password</h1>
          <p className="mt-1 text-sm text-[#6B6B66]">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-[#FDF2F0] border border-[#C54632]/20 px-3 py-2.5 text-sm text-[#C54632]">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              autoFocus
              {...register("password")}
              className="bg-white border-[#E5E5E2]"
            />
            {errors.password && (
              <p className="text-xs text-[#C54632]">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your new password"
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
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
