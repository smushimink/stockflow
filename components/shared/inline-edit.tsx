"use client";

import { useState, useRef, useCallback } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Pencil, Loader2 } from "lucide-react";

interface InlineEditProps<T> {
  value: T;
  displayValue?: string;
  schema: z.ZodType<T>;
  onSave: (value: T) => Promise<void>;
  className?: string;
  inputClassName?: string;
  prefix?: string;
  suffix?: string;
}

export function InlineEdit<T extends string | number>({
  value,
  displayValue,
  schema,
  onSave,
  className,
  inputClassName,
  prefix,
  suffix,
}: InlineEditProps<T>) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setInputValue(String(value));
    setEditing(true);
    setError(null);
    // Focus after render
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value]);

  const cancel = useCallback(() => {
    setEditing(false);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    const rawValue = typeof value === "number" ? Number(inputValue) : inputValue;
    const result = schema.safeParse(rawValue);

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid value");
      return;
    }

    setSaving(true);
    try {
      await onSave(result.data);
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [inputValue, schema, onSave, value]);

  if (editing) {
    return (
      <div className="inline-flex flex-col gap-0.5">
        <div className="inline-flex items-center gap-1">
          {prefix && <span className="text-sm text-[#6B6B66]">{prefix}</span>}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            onBlur={save}
            autoFocus
            className={cn(
              "border border-[#1A1A17] rounded px-2 py-0.5 text-sm tabular-nums",
              "focus:outline-none focus:ring-1 focus:ring-[#1A1A17]",
              "w-[100px] bg-white",
              inputClassName
            )}
          />
          {suffix && <span className="text-sm text-[#6B6B66]">{suffix}</span>}
          {saving && <Loader2 size={12} className="animate-spin text-[#6B6B66]" />}
        </div>
        {error && <p className="text-[10px] text-[#C54632]">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded px-1 py-0.5",
        "hover:bg-[#F0F0EE] transition-colors text-left",
        className
      )}
    >
      <span className="text-sm tabular-nums text-[#1A1A17]">
        {prefix}{displayValue ?? String(value)}{suffix}
      </span>
      <Pencil
        size={10}
        className="opacity-0 group-hover:opacity-40 transition-opacity text-[#6B6B66] shrink-0"
      />
    </button>
  );
}
