"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBusinessContext } from "@/app/(dashboard)/settings/business/actions";
import type { BusinessContext } from "@/lib/decisions/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  business_type: z.enum(["wholesale", "retail", "d2c", "mixed"]),
  industry: z.enum(["food_grocery", "beauty", "homeware", "apparel", "electronics", "industrial", "other"]),
  products_perishable: z.boolean(),
  avg_shelf_life_days: z.number().positive().nullable(),
  warehouse_size_sqm: z.number().positive().nullable(),
  warehouse_cost_monthly: z.number().nonnegative().nullable(),
  payment_terms_default_days: z.number().int().min(1).max(365),
  primary_currency: z.string().length(3),
  primary_country: z.string().min(2).max(3),
  active_seasons: z.array(z.string()),
  business_age_months: z.number().int().min(0),
  primary_sales_channels: z.array(z.string()),
  customer_concentration_risk_threshold: z.number().min(1).max(100),
  notes: z.string().max(1000),
});

type FormValues = z.infer<typeof schema>;

const INDUSTRY_OPTIONS = [
  { value: "food_grocery", label: "Food & Grocery" },
  { value: "beauty", label: "Beauty & Personal Care" },
  { value: "homeware", label: "Homeware" },
  { value: "apparel", label: "Apparel" },
  { value: "electronics", label: "Electronics" },
  { value: "industrial", label: "Industrial & B2B" },
  { value: "other", label: "Other" },
] as const;

const BUSINESS_TYPE_OPTIONS = [
  { value: "wholesale", label: "Wholesale" },
  { value: "retail", label: "Retail" },
  { value: "d2c", label: "Direct-to-Consumer (D2C)" },
  { value: "mixed", label: "Mixed" },
] as const;

const SEASON_OPTIONS = ["CNY", "Christmas", "Easter", "EOFY", "Back to school", "Mother's Day", "Halloween", "Valentine's Day"];

const CHANNEL_OPTIONS = [
  { value: "b2b_direct", label: "B2B Direct" },
  { value: "shopify", label: "Shopify" },
  { value: "amazon", label: "Amazon" },
  { value: "in_store", label: "In-Store / Physical" },
  { value: "wholesale_portal", label: "Wholesale Portal" },
];

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-sm font-500 text-[#1A1A17]">{children}</Label>
      {hint && <p className="text-xs text-[#6B6B66]">{hint}</p>}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full h-10 px-3 rounded-lg border border-[#E5E5E2] bg-white text-sm text-[#1A1A17]",
        "focus:outline-none focus:ring-2 focus:ring-[#1A1A17] focus:ring-offset-0",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function CheckboxGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter((x) => x !== item) : [...value, item]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-500 border transition-colors",
            value.includes(opt)
              ? "bg-[#1A1A17] text-white border-[#1A1A17]"
              : "bg-white text-[#6B6B66] border-[#E5E5E2] hover:border-[#1A1A17] hover:text-[#1A1A17]"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function BusinessProfileForm({ initialValues }: { initialValues: BusinessContext }) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...initialValues,
      avg_shelf_life_days: initialValues.avg_shelf_life_days ?? undefined,
      warehouse_size_sqm: initialValues.warehouse_size_sqm ?? undefined,
      warehouse_cost_monthly: initialValues.warehouse_cost_monthly ?? undefined,
    },
  });

  const isPerishable = watch("products_perishable");

  async function onSubmit(data: FormValues) {
    setSaving(true);
    try {
      const result = await saveBusinessContext({
        ...data,
        avg_shelf_life_days: data.avg_shelf_life_days ?? null,
        warehouse_size_sqm: data.warehouse_size_sqm ?? null,
        warehouse_cost_monthly: data.warehouse_cost_monthly ?? null,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Business profile saved");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">

      {/* Business type + Industry */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <FieldLabel>Business type</FieldLabel>
          <Controller
            name="business_type"
            control={control}
            render={({ field }) => (
              <NativeSelect value={field.value} onChange={field.onChange} options={BUSINESS_TYPE_OPTIONS} />
            )}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel hint="Affects dead stock and reorder thresholds">Industry</FieldLabel>
          <Controller
            name="industry"
            control={control}
            render={({ field }) => (
              <NativeSelect value={field.value} onChange={field.onChange} options={INDUSTRY_OPTIONS} />
            )}
          />
        </div>
      </div>

      {/* Perishable */}
      <div className="space-y-4 p-4 rounded-xl border border-[#E5E5E2] bg-[#F7F7F5]">
        <div className="flex items-center justify-between">
          <FieldLabel hint="Shrinks dead stock thresholds to shelf life × 0.7">Products are perishable</FieldLabel>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" {...register("products_perishable")} />
            <div className="w-11 h-6 bg-[#E5E5E2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#1A1A17] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
        </div>
        {isPerishable && (
          <div className="space-y-1.5">
            <FieldLabel hint="Red threshold = shelf life × 0.7">Average shelf life (days)</FieldLabel>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 90"
              className="bg-white border-[#E5E5E2] max-w-xs"
              {...register("avg_shelf_life_days", { valueAsNumber: true })}
            />
            {errors.avg_shelf_life_days && (
              <p className="text-xs text-[#C54632]">{errors.avg_shelf_life_days.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Active seasons */}
      <div className="space-y-1.5">
        <FieldLabel hint="Seasonal pre-order rule only fires for these seasons">Active seasons</FieldLabel>
        <Controller
          name="active_seasons"
          control={control}
          render={({ field }) => (
            <CheckboxGroup options={SEASON_OPTIONS} value={field.value} onChange={field.onChange} />
          )}
        />
        <p className="text-xs text-[#6B6B66]">Leave all unselected to monitor all seasons.</p>
      </div>

      {/* Payment terms */}
      <div className="space-y-1.5">
        <FieldLabel hint="Default for slow-payer detection when customer record has no payment terms">
          Default payment terms (days)
        </FieldLabel>
        <Input
          type="number"
          min={1}
          max={365}
          className="bg-white border-[#E5E5E2] max-w-xs"
          {...register("payment_terms_default_days", { valueAsNumber: true })}
        />
        {errors.payment_terms_default_days && (
          <p className="text-xs text-[#C54632]">{errors.payment_terms_default_days.message}</p>
        )}
      </div>

      {/* Sales channels */}
      <div className="space-y-1.5">
        <FieldLabel>Primary sales channels</FieldLabel>
        <Controller
          name="primary_sales_channels"
          control={control}
          render={({ field }) => (
            <CheckboxGroup
              options={CHANNEL_OPTIONS.map((c) => c.value)}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <div className="flex flex-wrap gap-2 mt-1">
          {CHANNEL_OPTIONS.map((c) => (
            <span key={c.value} className="text-xs text-[#6B6B66]">{c.value} = {c.label}</span>
          ))}
        </div>
      </div>

      {/* Warehouse */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <FieldLabel hint="Optional — used for profit-per-sqm metric">Warehouse size (sqm)</FieldLabel>
          <Input
            type="number"
            min={1}
            placeholder="e.g. 500"
            className="bg-white border-[#E5E5E2]"
            {...register("warehouse_size_sqm", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel hint="Monthly rent or occupancy cost">Warehouse cost / month ($)</FieldLabel>
          <Input
            type="number"
            min={0}
            placeholder="e.g. 8000"
            className="bg-white border-[#E5E5E2]"
            {...register("warehouse_cost_monthly", { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Currency + Country */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <FieldLabel>Primary currency (ISO 4217)</FieldLabel>
          <Input
            maxLength={3}
            placeholder="AUD"
            className="bg-white border-[#E5E5E2] uppercase"
            {...register("primary_currency")}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Country (ISO 3166)</FieldLabel>
          <Input
            maxLength={3}
            placeholder="AU"
            className="bg-white border-[#E5E5E2] uppercase"
            {...register("primary_country")}
          />
        </div>
      </div>

      {/* Customer concentration */}
      <div className="space-y-1.5">
        <FieldLabel hint="Triggers a risk alert when a single customer accounts for more than this % of revenue">
          Customer concentration risk threshold (%)
        </FieldLabel>
        <Input
          type="number"
          min={1}
          max={100}
          className="bg-white border-[#E5E5E2] max-w-xs"
          {...register("customer_concentration_risk_threshold", { valueAsNumber: true })}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <FieldLabel hint="Free text — describe quirks that help the AI make better decisions">
          Business notes
        </FieldLabel>
        <textarea
          rows={3}
          placeholder="e.g. We primarily sell to restaurants. Seasonal peaks around CNY. Most customers are net-60."
          className="w-full px-3 py-2 rounded-lg border border-[#E5E5E2] bg-white text-sm text-[#1A1A17] placeholder:text-[#C8C8C4] resize-none focus:outline-none focus:ring-2 focus:ring-[#1A1A17]"
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-xs text-[#C54632]">{errors.notes.message}</p>
        )}
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={saving}
          className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-10 px-6"
        >
          {saving ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
