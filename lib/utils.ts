import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-AU").format(value);
}

/** Supabase returns joined rows as arrays in the untyped client; normalize to single object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function firstOf<T>(v: unknown): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return (v as T[])[0] ?? null;
  return v as T;
}
