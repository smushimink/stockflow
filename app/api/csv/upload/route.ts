import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Papa from "papaparse";
import { z } from "zod";

const productRowSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unit_cost: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0).default(0),
  stock_on_hand: z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  supplier: z.string().optional(),
  reorder_point: z.coerce.number().int().min(0).default(0),
  barcode: z.string().optional(),
});

type Mapping = { source: string; target: string; confidence: number };

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const orgId = membership.organization_id;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const mappingsJson = formData.get("mappings") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: `Parse error: ${parsed.errors[0].message}` }, { status: 400 });
  }

  // Build column mapping
  const mappings: Mapping[] = mappingsJson ? JSON.parse(mappingsJson) : [];
  const columnMap: Record<string, string> = {};
  for (const m of mappings) {
    if (m.target && m.target !== "_skip") {
      columnMap[m.source] = m.target;
    }
  }

  // If no explicit mappings, auto-detect from headers
  if (Object.keys(columnMap).length === 0 && parsed.data.length > 0) {
    const headers = Object.keys(parsed.data[0]);
    for (const h of headers) {
      const normalized = h.toLowerCase().replace(/[\s_-]/g, "");
      if (["sku", "code", "codigo", "ref"].some((k) => normalized.includes(k))) columnMap[h] = "sku";
      else if (["name", "description", "nombre", "descripcion"].some((k) => normalized.includes(k))) columnMap[h] = "name";
      else if (["cost", "costo", "purchaseprice"].some((k) => normalized.includes(k))) columnMap[h] = "unit_cost";
      else if (["price", "pvp", "sellingprice"].some((k) => normalized.includes(k))) columnMap[h] = "selling_price";
      else if (["stock", "qty", "quantity", "existencias"].some((k) => normalized.includes(k))) columnMap[h] = "stock_on_hand";
      else if (["supplier", "vendor", "proveedor"].some((k) => normalized.includes(k))) columnMap[h] = "supplier";
      else if (["category", "categoria"].some((k) => normalized.includes(k))) columnMap[h] = "category";
    }
  }

  // Look up or cache supplier IDs
  const supplierCache: Record<string, string> = {};

  async function getOrCreateSupplier(name: string): Promise<string | null> {
    if (!name.trim()) return null;
    if (supplierCache[name]) return supplierCache[name];

    const { data: existing } = await supabase
      .from("suppliers")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .limit(1)
      .single();

    if (existing) {
      supplierCache[name] = existing.id;
      return existing.id;
    }

    const { data: created } = await supabase
      .from("suppliers")
      .insert({ organization_id: orgId, name: name.trim() })
      .select("id")
      .single();

    if (created) {
      supplierCache[name] = created.id;
      return created.id;
    }

    return null;
  }

  let imported = 0;
  const errors: string[] = [];

  for (const row of parsed.data) {
    // Map columns
    const mapped: Record<string, string> = {};
    for (const [csvCol, target] of Object.entries(columnMap)) {
      if (row[csvCol] !== undefined) {
        mapped[target] = row[csvCol];
      }
    }

    const result = productRowSchema.safeParse(mapped);
    if (!result.success) {
      errors.push(`Row SKU "${mapped.sku ?? "?"}" — ${result.error.issues[0]?.message}`);
      continue;
    }

    const data = result.data;
    const supplierId = data.supplier ? await getOrCreateSupplier(data.supplier) : null;

    const { error } = await supabase
      .from("products")
      .upsert(
        {
          organization_id: orgId,
          sku: data.sku,
          name: data.name,
          unit_cost: data.unit_cost,
          selling_price: data.selling_price,
          stock_on_hand: data.stock_on_hand,
          reorder_point: data.reorder_point,
          category: data.category ?? null,
          barcode: data.barcode ?? null,
          supplier_id: supplierId,
          status: "active",
        },
        { onConflict: "organization_id,sku" }
      );

    if (error) {
      errors.push(`SKU "${data.sku}" — ${error.message}`);
    } else {
      imported++;
    }
  }

  return NextResponse.json({ imported, errors: errors.slice(0, 10) });
}
