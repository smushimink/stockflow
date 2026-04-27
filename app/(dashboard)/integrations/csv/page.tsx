"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check, AlertTriangle } from "lucide-react";

type MappingRow = {
  source: string;
  target: string | null;
  confidence: number;
  examples: string[];
};

const TARGET_FIELDS = [
  { id: "sku", label: "SKU" },
  { id: "name", label: "Product name" },
  { id: "unit_cost", label: "Cost price" },
  { id: "selling_price", label: "Selling price" },
  { id: "stock_on_hand", label: "Stock qty" },
  { id: "supplier", label: "Supplier" },
  { id: "category", label: "Category" },
  { id: "reorder_point", label: "Reorder point" },
  { id: "barcode", label: "Barcode" },
  { id: "_skip", label: "— Skip —" },
];

export default function CsvImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [mapping, setMapping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const parseFile = useCallback((f: File) => {
    setFile(f);
    Papa.parse(f, {
      preview: 6,
      complete: (results) => {
        const rows = results.data as string[][];
        if (!rows.length) return;
        setHeaders(rows[0]);
        setPreview(rows.slice(1, 6));
        setMappings([]);
      },
      error: (err) => alert(`Parse error: ${err.message}`),
    });
  }, []);

  async function suggestMappings() {
    if (!headers.length) return;
    setMapping(true);
    try {
      const res = await fetch("/api/csv/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: headers, samples: preview }),
      });
      const data = await res.json();
      setMappings(
        headers.map((h, i) => ({
          source: h,
          target: data.mappings?.[i]?.target ?? null,
          confidence: data.mappings?.[i]?.confidence ?? 0,
          examples: preview.map((row) => row[i] ?? "").slice(0, 3),
        }))
      );
    } catch (e) {
      // Fallback: simple heuristic
      setMappings(
        headers.map((h, i) => ({
          source: h,
          target: guessField(h),
          confidence: 0.5,
          examples: preview.map((row) => row[i] ?? "").slice(0, 3),
        }))
      );
    } finally {
      setMapping(false);
    }
  }

  function updateMapping(index: number, target: string) {
    setMappings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], target };
      return next;
    });
  }

  async function runImport() {
    if (!file || !mappings.length) return;
    setImporting(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mappings", JSON.stringify(mappings));

    const res = await fetch("/api/csv/upload", { method: "POST", body: formData });
    const data = await res.json();
    setResult(data);
    setImporting(false);
  }

  const step = !file ? 1 : mappings.length === 0 ? 2 : result ? 4 : 3;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <nav className="flex items-center gap-1.5 text-xs text-[#6B6B66]">
        <Link href="/integrations" className="hover:text-[#1A1A17]">Integrations</Link>
        <ChevronRight size={12} />
        <span className="text-[#1A1A17] font-500">CSV Import</span>
      </nav>

      <div>
        <h1 className="text-2xl font-600 text-[#1A1A17]">CSV Import</h1>
        <p className="text-sm text-[#6B6B66] mt-1">Upload a product spreadsheet. AI will suggest column mappings.</p>
      </div>

      {/* Step 1: File upload */}
      <div className={cn("space-y-3", step > 1 && file && "opacity-60")}>
        <div className="flex items-center gap-2">
          <StepBadge n={1} active={step === 1} done={step > 1} />
          <p className="text-sm font-500 text-[#1A1A17]">Upload file</p>
        </div>
        {(step === 1 || file) && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f?.name.endsWith(".csv")) parseFile(f);
            }}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors bg-white",
              isDragging ? "border-[#1A1A17]" : file ? "border-[#4D7B3D]" : "border-[#E5E5E2]"
            )}
          >
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-500 text-[#4D7B3D]">{file.name}</p>
                <p className="text-xs text-[#6B6B66]">{headers.length} columns · {preview.length}+ rows detected</p>
                <button onClick={() => { setFile(null); setHeaders([]); setPreview([]); setMappings([]); setResult(null); }}
                  className="text-xs text-[#C54632] underline mt-1">Remove</button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-[#6B6B66]">Drop CSV here or <label className="underline cursor-pointer text-[#1A1A17]">browse<input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} /></label></p>
                <p className="text-xs text-[#6B6B66]">Accepts .csv files up to 10MB</p>
              </div>
            )}
          </div>
        )}
        {file && step === 2 && (
          <Button
            onClick={suggestMappings}
            disabled={mapping}
            className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-9 px-4 text-sm"
          >
            {mapping ? "Analysing columns..." : "Suggest column mappings →"}
          </Button>
        )}
      </div>

      {/* Step 2: Column mapping */}
      {mappings.length > 0 && !result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StepBadge n={2} active={step === 3} done={step > 3} />
            <p className="text-sm font-500 text-[#1A1A17]">Map columns</p>
            <span className="text-xs text-[#6B6B66]">Review and correct AI suggestions</span>
          </div>
          <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E2]">
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Your column</th>
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Maps to</th>
                  <th className="text-left px-4 py-2 text-xs font-600 text-[#6B6B66] uppercase tracking-wider">Examples</th>
                  <th className="px-4 py-2 w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E2]">
                {mappings.map((row, i) => (
                  <tr key={i} className={row.confidence < 0.7 ? "bg-[#FDF8EE]" : ""}>
                    <td className="px-4 py-2 font-500 text-[#1A1A17]">{row.source}</td>
                    <td className="px-4 py-2">
                      <select
                        value={row.target ?? "_skip"}
                        onChange={(e) => updateMapping(i, e.target.value)}
                        className="text-sm border border-[#E5E5E2] rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#1A1A17]"
                      >
                        {TARGET_FIELDS.map((f) => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-xs text-[#6B6B66] truncate max-w-[180px]">
                      {row.examples.filter(Boolean).join(", ")}
                    </td>
                    <td className="px-4 py-2">
                      {row.confidence >= 0.7 ? (
                        <Check size={12} className="text-[#4D7B3D]" />
                      ) : (
                        <AlertTriangle size={12} className="text-[#B47214]" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            onClick={runImport}
            disabled={importing}
            className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-9 px-4 text-sm"
          >
            {importing ? "Importing..." : "Confirm and import →"}
          </Button>
        </div>
      )}

      {/* Step 3: Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StepBadge n={3} active done />
            <p className="text-sm font-500 text-[#1A1A17]">Import complete</p>
          </div>
          <div className="bg-[#F2F8F0] border border-[#4D7B3D]/20 rounded-lg px-4 py-3 space-y-1">
            <p className="text-sm font-500 text-[#4D7B3D]">{result.imported} products imported</p>
            {result.errors.length > 0 && (
              <p className="text-xs text-[#B47214]">{result.errors.length} rows skipped — {result.errors[0]}</p>
            )}
          </div>
          <Link href="/products">
            <Button className="bg-[#1A1A17] text-white hover:bg-[#2D2D29] h-9 px-4 text-sm">
              Go to Products →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function StepBadge({ n, active, done }: { n: number; active?: boolean; done?: boolean }) {
  return (
    <div className={cn(
      "w-5 h-5 rounded-full flex items-center justify-center text-xs font-600 shrink-0",
      done ? "bg-[#4D7B3D] text-white"
        : active ? "bg-[#1A1A17] text-white"
        : "bg-[#E5E5E2] text-[#6B6B66]"
    )}>
      {done ? <Check size={10} /> : n}
    </div>
  );
}

function guessField(header: string): string {
  const h = header.toLowerCase().replace(/[_\s-]/g, "");
  if (["sku", "code", "codigo", "ref", "reference", "productcode"].some((k) => h.includes(k))) return "sku";
  if (["name", "description", "product", "nombre", "descripcion", "title"].some((k) => h.includes(k))) return "name";
  if (["cost", "costo", "purchaseprice", "costprice", "preciocompra"].some((k) => h.includes(k))) return "unit_cost";
  if (["price", "pvp", "sellingprice", "retailprice", "precioventa", "sale"].some((k) => h.includes(k))) return "selling_price";
  if (["stock", "qty", "quantity", "onhand", "existencias", "inventory"].some((k) => h.includes(k))) return "stock_on_hand";
  if (["supplier", "vendor", "proveedor"].some((k) => h.includes(k))) return "supplier";
  if (["category", "categoria", "type"].some((k) => h.includes(k))) return "category";
  return "_skip";
}
