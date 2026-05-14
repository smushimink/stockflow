"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createOrganization, saveOnboardingBusinessContext, saveRulePreferences } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RULE_SCHEMAS } from "@/lib/decisions/rule-schemas";
import { RULE_PRIORITY_ORDER } from "@/lib/plans";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "workspace" | "data" | "profile" | "rules" | "done";

const STARTER_MAX_RULES = 5;

const workspaceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
});
type WorkspaceForm = z.infer<typeof workspaceSchema>;

const INDUSTRY_OPTIONS = [
  { value: "food_grocery", label: "Food & Grocery" },
  { value: "beauty", label: "Beauty & Personal Care" },
  { value: "homeware", label: "Homeware" },
  { value: "apparel", label: "Apparel" },
  { value: "electronics", label: "Electronics" },
  { value: "industrial", label: "Industrial / B2B" },
  { value: "other", label: "Other" },
] as const;

const SEASON_OPTIONS = ["CNY", "Christmas", "Easter", "EOFY", "Back to school", "Mother's Day", "Halloween", "Valentine's Day"];

// Default first 5 rules enabled for Starter plan
const DEFAULT_ENABLED = new Set(RULE_PRIORITY_ORDER.slice(0, STARTER_MAX_RULES));

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "data", label: "Your data" },
  { id: "profile", label: "Business profile" },
  { id: "rules", label: "Decision rules" },
  { id: "done", label: "Done" },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          {i > 0 && <div className="w-6 h-px bg-[#E5E5E2]" />}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-xs font-600",
                current === s.id
                  ? "bg-[#1A1A17] text-white"
                  : currentIdx > i
                  ? "bg-[#4D7B3D] text-white"
                  : "bg-[#E5E5E2] text-[#6B6B66]"
              )}
            >
              {currentIdx > i ? "✓" : i + 1}
            </div>
            <span className={cn("text-xs hidden sm:inline", current === s.id ? "text-[#1A1A17] font-500" : "text-[#6B6B66]")}>
              {s.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("workspace");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Profile state
  const [industry, setIndustry] = useState("other");
  const [isPerishable, setIsPerishable] = useState(false);
  const [shelfLife, setShelfLife] = useState("");
  const [activeSeasons, setActiveSeasons] = useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = useState("30");
  const [notes, setNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Rules state
  const [enabledRules, setEnabledRules] = useState<Set<string>>(new Set(DEFAULT_ENABLED));
  const [savingRules, setSavingRules] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<WorkspaceForm>({
    resolver: zodResolver(workspaceSchema),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function createWorkspace(data: WorkspaceForm) {
    const result = await createOrganization(data.name);
    if ("error" in result) {
      if (result.error === "Not authenticated") { router.push("/login"); return; }
      alert(result.error);
      return;
    }
    setOrgId(result.orgId);
    setStep("data");
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) setCsvFile(file);
  }, []);

  async function importCsv() {
    if (!csvFile || !orgId) return;
    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("orgId", orgId);
    const response = await fetch("/api/csv/upload", { method: "POST", body: formData });
    if (response.ok) {
      setStep("profile");
    } else {
      const error = await response.json();
      alert(error.message || "Import failed");
      setIsImporting(false);
    }
  }

  function toggleSeason(s: string) {
    setActiveSeasons((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function saveProfile() {
    if (!orgId) { router.push("/today"); return; }
    setSavingProfile(true);
    await saveOnboardingBusinessContext(orgId, {
      industry: industry as never,
      products_perishable: isPerishable,
      avg_shelf_life_days: isPerishable && shelfLife ? parseInt(shelfLife) : null,
      active_seasons: activeSeasons,
      payment_terms_default_days: parseInt(paymentTerms) || 30,
      notes,
    });
    setSavingProfile(false);
    setStep("rules");
  }

  function toggleRule(ruleType: string) {
    setEnabledRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleType)) {
        next.delete(ruleType);
      } else {
        if (next.size >= STARTER_MAX_RULES) return prev; // limit reached
        next.add(ruleType);
      }
      return next;
    });
  }

  async function saveRules() {
    if (!orgId) { router.push("/today"); return; }
    setSavingRules(true);
    await saveRulePreferences(orgId, Array.from(enabledRules));
    setSavingRules(false);
    setStep("done");
  }

  const orderedRuleTypes = RULE_PRIORITY_ORDER.filter((rt) => RULE_SCHEMAS[rt]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 border-b border-[#E5E5E2] bg-white">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="font-600 text-[#1A1A17]">ArachNet</span>
          <StepIndicator current={step} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-8 pt-14 pb-16">
        <div className="w-full max-w-xl">

          {/* ── Step 1: Workspace ── */}
          {step === "workspace" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-600 text-[#1A1A17]">Create your workspace</h1>
                <p className="mt-1 text-sm text-[#6B6B66]">
                  This is the name of your business — you can change it later.
                </p>
              </div>
              <form onSubmit={handleSubmit(createWorkspace)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-500">Workspace name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Acme Wholesale"
                    autoFocus
                    {...register("name")}
                    className="bg-white border-[#E5E5E2] text-lg h-12"
                  />
                  {errors.name && (
                    <p className="text-xs text-[#C54632]">{errors.name.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-11 px-6"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Continue →"}
                </Button>
              </form>
            </div>
          )}

          {/* ── Step 2: Data ── */}
          {step === "data" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-600 text-[#1A1A17]">Connect your data</h1>
                <p className="mt-1 text-sm text-[#6B6B66]">
                  Upload a product CSV or start with demo data. You can add more data sources later.
                </p>
              </div>

              <div className="space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                    isDragging ? "border-[#1A1A17] bg-[#F0F0EE]" : "border-[#E5E5E2] bg-white",
                    csvFile && "border-[#4D7B3D] bg-[#F2F8F0]"
                  )}
                >
                  {csvFile ? (
                    <div className="space-y-2">
                      <div className="text-sm font-500 text-[#4D7B3D]">{csvFile.name}</div>
                      <div className="text-xs text-[#6B6B66]">{(csvFile.size / 1024).toFixed(1)} KB</div>
                      <button onClick={() => setCsvFile(null)} className="text-xs text-[#C54632] underline">Remove</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm text-[#6B6B66]">
                        Drop your CSV here, or{" "}
                        <label className="underline cursor-pointer text-[#1A1A17]">
                          browse
                          <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCsvFile(f); }} />
                        </label>
                      </div>
                      <div className="text-xs text-[#6B6B66]">Needs: SKU, product name, cost price, selling price, stock quantity</div>
                    </div>
                  )}
                </div>
                {csvFile && (
                  <Button
                    onClick={importCsv}
                    disabled={isImporting}
                    className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-11 px-6"
                  >
                    {isImporting ? "Importing..." : "Import and continue →"}
                  </Button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E5E2]" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-[#F7F7F5] px-3 text-[#6B6B66]">or</span></div>
              </div>

              <button
                onClick={() => setStep("profile")}
                className="w-full text-sm text-[#6B6B66] hover:text-[#1A1A17] underline text-left"
              >
                Skip and use demo data — explore the product with sample warehouse data
              </button>
            </div>
          )}

          {/* ── Step 3: Business profile ── */}
          {step === "profile" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-600 text-[#1A1A17]">Tell us about your business</h1>
                <p className="mt-1 text-sm text-[#6B6B66]">
                  ArachNet uses this to calibrate its decision rules. You can update everything later in Settings.
                </p>
              </div>

              <div className="space-y-6">
                {/* Q1: Industry */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-500">What kind of products do you sell?</Label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E5E5E2] bg-white text-sm text-[#1A1A17] focus:outline-none focus:ring-2 focus:ring-[#1A1A17]"
                  >
                    {INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Q2: Perishable */}
                <div className="space-y-3">
                  <Label className="text-sm font-500">Are your products perishable?</Label>
                  <div className="flex gap-3">
                    {["yes", "no"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setIsPerishable(v === "yes")}
                        className={cn(
                          "px-6 py-2 rounded-lg border text-sm font-500 transition-colors",
                          (v === "yes") === isPerishable
                            ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                            : "bg-white text-[#6B6B66] border-[#E5E5E2] hover:border-[#1A1A17]"
                        )}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                  {isPerishable && (
                    <div className="space-y-1">
                      <p className="text-xs text-[#6B6B66]">Average shelf life in days</p>
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g. 90"
                        value={shelfLife}
                        onChange={(e) => setShelfLife(e.target.value)}
                        className="bg-white border-[#E5E5E2] max-w-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Q3: Seasons */}
                <div className="space-y-2">
                  <Label className="text-sm font-500">Which seasons matter for your business?</Label>
                  <p className="text-xs text-[#6B6B66]">Seasonal pre-order alerts only fire for selected seasons. Skip if unsure.</p>
                  <div className="flex flex-wrap gap-2">
                    {SEASON_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSeason(s)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-500 border transition-colors",
                          activeSeasons.includes(s)
                            ? "bg-[#1A1A17] text-white border-[#1A1A17]"
                            : "bg-white text-[#6B6B66] border-[#E5E5E2] hover:border-[#1A1A17]"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Q4: Payment terms */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-500">What payment terms do you typically offer? (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="bg-white border-[#E5E5E2] max-w-xs"
                  />
                </div>

                {/* Q5: Notes */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-500">Anything quirky about your business we should know?</Label>
                  <textarea
                    rows={2}
                    placeholder="e.g. We sell to restaurants mainly. Big EOFY spike every June."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5E2] bg-white text-sm text-[#1A1A17] placeholder:text-[#C8C8C4] resize-none focus:outline-none focus:ring-2 focus:ring-[#1A1A17]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-11 px-6"
                >
                  {savingProfile ? "Saving..." : "Continue →"}
                </Button>
                <button
                  onClick={() => setStep("rules")}
                  className="text-sm text-[#6B6B66] hover:text-[#1A1A17] underline"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Rules setup ── */}
          {step === "rules" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-600 text-[#1A1A17]">Choose your decision rules</h1>
                <p className="mt-1 text-sm text-[#6B6B66]">
                  Your Starter plan includes up to <strong>{STARTER_MAX_RULES} active rules</strong>. Pick the ones that matter most — you can change them anytime in Settings.
                </p>
              </div>

              {/* Rules selection */}
              <div className="space-y-2">
                {orderedRuleTypes.map((ruleType, i) => {
                  const schema = RULE_SCHEMAS[ruleType];
                  if (!schema) return null;
                  const isLocked = i >= STARTER_MAX_RULES;
                  const isEnabled = enabledRules.has(ruleType);
                  const atLimit = enabledRules.size >= STARTER_MAX_RULES && !isEnabled;

                  return (
                    <button
                      key={ruleType}
                      type="button"
                      disabled={isLocked || atLimit}
                      onClick={() => !isLocked && toggleRule(ruleType)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border text-left transition-all",
                        isLocked
                          ? "border-[#F0F0EE] bg-[#FAFAF8] opacity-60 cursor-not-allowed"
                          : isEnabled
                          ? "border-[#1A1A17] bg-white"
                          : atLimit
                          ? "border-[#E5E5E2] bg-white opacity-50 cursor-not-allowed"
                          : "border-[#E5E5E2] bg-white hover:border-[#1A1A17]"
                      )}
                    >
                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          isEnabled && !isLocked
                            ? "bg-[#1A1A17] border-[#1A1A17]"
                            : "border-[#D4D4D0] bg-white"
                        )}
                      >
                        {isEnabled && !isLocked && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3l2.5 2.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-500 text-[#1A1A17]">{schema.label}</p>
                        <p className="text-xs text-[#6B6B66]">{schema.description}</p>
                      </div>

                      {isLocked && (
                        <span className="text-[10px] font-600 px-1.5 py-0.5 rounded bg-[#F0F0EE] text-[#6B6B66] uppercase tracking-wide shrink-0">
                          Pro
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-[#6B6B66]">
                  {enabledRules.size} / {STARTER_MAX_RULES} rules selected
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.push("/today")}
                    className="text-sm text-[#6B6B66] hover:text-[#1A1A17] underline"
                  >
                    Skip
                  </button>
                  <Button
                    onClick={saveRules}
                    disabled={savingRules || enabledRules.size === 0}
                    className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-11 px-6"
                  >
                    {savingRules ? "Saving..." : "Save and finish →"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center text-center py-8 space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#F2F8F0] flex items-center justify-center">
                <CheckCircle2 size={32} className="text-[#4D7B3D]" />
              </div>
              <div>
                <h1 className="text-2xl font-600 text-[#1A1A17]">You&apos;re all set</h1>
                <p className="mt-2 text-sm text-[#6B6B66] max-w-sm">
                  Your workspace is ready. ArachNet will analyse your data and surface your first decisions within a few minutes.
                </p>
              </div>
              <div className="space-y-2 text-left w-full max-w-sm">
                {[
                  "Daily action feed — your decisions, ranked by urgency",
                  "Inventory & sales insights — visualised and explained",
                  "Rule configuration — adjust thresholds to fit your business",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-[#5C5C57]">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#4D7B3D]" />
                    {item}
                  </div>
                ))}
              </div>
              <Button
                onClick={() => router.push("/today")}
                className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-11 px-8 mt-2"
              >
                Go to dashboard →
              </Button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
