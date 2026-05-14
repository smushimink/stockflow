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

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError("email", { message: error.message });
      return;
    }

    setSentEmail(data.email);
    setSent(true);
  }

  if (sent) {
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
              We sent a password reset link to{" "}
              <span className="font-medium text-[#1A1A17]">{sentEmail}</span>
            </p>
          </div>
          <div className="space-y-2 text-xs text-[#6B6B66]">
            <p>
              Didn&apos;t get it?{" "}
              <button
                onClick={() => setSent(false)}
                className="underline hover:text-[#1A1A17]"
              >
                Send again
              </button>
            </p>
            <p>
              <Link href="/login" className="underline hover:text-[#1A1A17]">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] px-4">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A17]">Reset password</h1>
          <p className="mt-1 text-sm text-[#6B6B66]">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
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

          <Button
            type="submit"
            className="w-full bg-[#1A1A17] text-white hover:bg-[#2D2D29]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <p className="text-xs text-center text-[#6B6B66]">
          Remembered it?{" "}
          <Link href="/login" className="underline hover:text-[#1A1A17]">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
