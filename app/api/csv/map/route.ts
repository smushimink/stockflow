import { NextResponse } from "next/server";

const FIELD_VARIANTS: Record<string, string[]> = {
  sku: ["sku", "code", "codigo", "ref", "reference", "product_code", "productcode", "item_code"],
  name: ["name", "description", "product", "nombre", "descripcion", "title", "product_name"],
  unit_cost: ["cost", "costo", "purchase_price", "cost_price", "precio_compra", "unit_cost", "buy_price"],
  selling_price: ["price", "pvp", "selling_price", "retail_price", "precio_venta", "sale_price", "rrp"],
  stock_on_hand: ["stock", "qty", "quantity", "on_hand", "existencias", "inventory", "stock_qty", "onhand"],
  supplier: ["supplier", "vendor", "proveedor", "manufacturer"],
  category: ["category", "categoria", "type", "product_type"],
  reorder_point: ["reorder", "reorder_point", "min_stock", "minimum_stock", "punto_reorden"],
  barcode: ["barcode", "ean", "upc", "gtin", "codigo_barra"],
};

function matchColumn(column: string): { target: string; confidence: number } {
  const normalized = column.toLowerCase().replace(/[\s_-]/g, "");

  for (const [target, variants] of Object.entries(FIELD_VARIANTS)) {
    for (const variant of variants) {
      const v = variant.replace(/[\s_-]/g, "");
      if (normalized === v) return { target, confidence: 1.0 };
      if (normalized.includes(v) || v.includes(normalized)) {
        return { target, confidence: 0.85 };
      }
    }
  }

  return { target: "_skip", confidence: 0.1 };
}

export async function POST(request: Request) {
  const { columns, samples } = await request.json();

  // Try Claude AI mapping first if key is available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const prompt = `You are mapping CSV columns to a canonical schema for an inventory management system.

Canonical fields:
- sku: unique product identifier (codes, SKUs, references, barcodes used as IDs)
- name: product description or title
- unit_cost: purchase cost (what the business pays suppliers)
- selling_price: retail/wholesale price (what customers pay)
- stock_on_hand: current inventory quantity
- supplier: supplier or vendor name
- category: product category or type
- reorder_point: minimum stock threshold
- barcode: EAN/UPC/GTIN barcode
- _skip: ignore this column

Columns to map: ${JSON.stringify(columns)}
Sample data (first 3 rows): ${JSON.stringify(samples?.slice(0, 3))}

Return ONLY valid JSON: {"mappings": [{"source": "ColName", "target": "field_id", "confidence": 0.0-1.0}]}
Where confidence 1.0 = certain, 0.7 = likely, 0.4 = guessing, 0.1 = skip.`;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      }
    } catch {
      // Fall through to heuristic
    }
  }

  // Heuristic fallback
  const mappings = columns.map((col: string) => ({
    source: col,
    ...matchColumn(col),
  }));

  return NextResponse.json({ mappings });
}
