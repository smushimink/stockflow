"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createOrganization } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const workspaceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
});

type WorkspaceForm = z.infer<typeof workspaceSchema>;

type Step = "workspace" | "data" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("workspace");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceForm>({ resolver: zodResolver(workspaceSchema) });

  async function createWorkspace(data: WorkspaceForm) {
    const result = await createOrganization(data.name);

    if ("error" in result) {
      if (result.error === "Not authenticated") {
        router.push("/login");
        return;
      }
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
    if (file && file.name.endsWith(".csv")) {
      setCsvFile(file);
    }
  }, []);

  async function useDemo() {
    router.push("/today");
  }

  async function importCsv() {
    if (!csvFile || !orgId) return;
    setIsImporting(true);

    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("orgId", orgId);

    const response = await fetch("/api/csv/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      router.push("/today");
    } else {
      const error = await response.json();
      alert(error.message || "Import failed");
      setIsImporting(false);
    }
  }

  const steps: { id: Step; label: string }[] = [
    { id: "workspace", label: "Workspace" },
    { id: "data", label: "Your data" },
    { id: "done", label: "Done" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E5E2] bg-white">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="font-600 text-[#1A1A17]">StockFlow</span>
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-[#E5E5E2]" />}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-xs font-600",
                      step === s.id
                        ? "bg-[#1A1A17] text-white"
                        : steps.findIndex((x) => x.id === step) > i
                        ? "bg-[#4D7B3D] text-white"
                        : "bg-[#E5E5E2] text-[#6B6B66]"
                    )}
                  >
                    {steps.findIndex((x) => x.id === step) > i ? "✓" : i + 1}
                  </div>
                  <span className={cn("text-xs", step === s.id ? "text-[#1A1A17] font-500" : "text-[#6B6B66]")}>
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-8 pt-16">
        <div className="w-full max-w-xl">

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
                  {isSubmitting ? "Creating..." : "Continue"}
                </Button>
              </form>
            </div>
          )}

          {step === "data" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-600 text-[#1A1A17]">Connect your data</h1>
                <p className="mt-1 text-sm text-[#6B6B66]">
                  Upload a product CSV or start with demo data. You can add more data sources later.
                </p>
              </div>

              {/* CSV upload */}
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
                      <button
                        onClick={() => setCsvFile(null)}
                        className="text-xs text-[#C54632] underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm text-[#6B6B66]">
                        Drop your CSV here, or{" "}
                        <label className="underline cursor-pointer text-[#1A1A17]">
                          browse
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setCsvFile(f);
                            }}
                          />
                        </label>
                      </div>
                      <div className="text-xs text-[#6B6B66]">
                        Needs: SKU, product name, cost price, selling price, stock quantity
                      </div>
                    </div>
                  )}
                </div>

                {csvFile && (
                  <Button
                    onClick={importCsv}
                    disabled={isImporting}
                    className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-11 px-6"
                  >
                    {isImporting ? "Importing..." : "Import and continue"}
                  </Button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E5E2]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#F7F7F5] px-3 text-[#6B6B66]">or</span>
                </div>
              </div>

              <button
                onClick={useDemo}
                className="w-full text-sm text-[#6B6B66] hover:text-[#1A1A17] underline text-left"
              >
                Skip and use demo data — explore the product with sample warehouse data
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
