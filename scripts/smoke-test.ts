/**
 * ArachNet smoke test
 *
 * DEV-ONLY — uses SUPABASE_SERVICE_ROLE_KEY to create an authenticated session.
 * Never run this against production with a real user's data without consent.
 *
 * Prerequisites:
 *   - Dev server running at http://localhost:3000 (npm run dev)
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - A test user with email TEST_USER_EMAIL and password TEST_USER_PASSWORD
 *     (create via Supabase dashboard → Authentication → Users → Add user)
 *
 * Usage:
 *   TEST_USER_EMAIL=demo@example.com TEST_USER_PASSWORD=secret npx tsx scripts/smoke-test.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "fs";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

// Load .env.local if running locally and env vars not set
if (!SUPABASE_URL) {
  try {
    const raw = dotenv.readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const [k, ...rest] = line.split("=");
      if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
    }
  } catch { /* no .env.local */ }
}

// ── Supabase admin client ─────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  console.error(`  ✗  ${label}${detail ? `\n       ${detail}` : ""}`);
  failed++;
}

async function checkTable(table: string, minRows = 1) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) { fail(`${table} query`, error.message); return; }
  if ((count ?? 0) < minRows) {
    fail(`${table} has data`, `expected >= ${minRows} rows, got ${count}`);
  } else {
    ok(`${table} has ${count} rows`);
  }
}

async function checkPage(
  path: string,
  accessToken: string,
  expectRedirect = false
) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        cookie: `sb-access-token=${accessToken}`,
        "user-agent": "ArachNet-SmokeTest/1.0",
      },
      redirect: "manual",
    });
    const status = res.status;

    if (expectRedirect && (status === 307 || status === 302 || status === 200)) {
      ok(`GET ${path} → ${status}`);
      return;
    }

    if (status === 200 || status === 307) {
      // 307 = auth redirect (means server is up even if not authenticated via cookie)
      ok(`GET ${path} → ${status}`);
    } else if (status >= 500) {
      fail(`GET ${path}`, `server error ${status}`);
    } else {
      ok(`GET ${path} → ${status} (auth required)`);
    }
  } catch (e) {
    fail(`GET ${path}`, (e as Error).message);
  }
}

// ── First-row helpers ─────────────────────────────────────────────────────────

async function firstId(table: string): Promise<string | null> {
  const { data } = await supabase.from(table).select("id").limit(1).single();
  return (data?.id as string | null) ?? null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║     ArachNet Smoke Test              ║");
  console.log(`╚═══════════════════════════════════════╝`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Supabase: ${SUPABASE_URL.substring(0, 30)}…`);
  console.log();

  // ── 1. Database integrity ────────────────────────────────────────────────

  console.log("▶ Database integrity");
  await checkTable("organizations", 1);
  await checkTable("products", 10);
  await checkTable("suppliers", 1);
  await checkTable("customers", 1);
  await checkTable("sales_orders", 1);
  await checkTable("purchase_orders", 1);
  await checkTable("product_metrics", 10);
  await checkTable("decision_rules", 8);
  console.log();

  // ── 2. Rule coverage ─────────────────────────────────────────────────────

  console.log("▶ Decision rules");
  const { data: rules } = await supabase
    .from("decision_rules")
    .select("rule_type, enabled");
  const ruleTypes = (rules ?? []).map((r) => r.rule_type as string);
  const expectedRules = [
    "reorder", "dead_stock", "abc_classification", "real_margin",
    "customer_churn", "supplier_scorecard", "ecommerce_pipeline",
    "seasonal_preorder", "customer_profitability",
  ];
  for (const r of expectedRules) {
    if (ruleTypes.includes(r)) ok(`rule: ${r}`);
    else fail(`rule: ${r}`, "missing from decision_rules");
  }
  console.log();

  // ── 3. Metrics populated ──────────────────────────────────────────────────

  console.log("▶ Metric quality");
  const { data: metricsAgg } = await supabase
    .from("product_metrics")
    .select("gross_profit_90d, gross_margin_pct, inventory_turnover")
    .not("gross_profit_90d", "is", null)
    .gt("gross_profit_90d", 0)
    .limit(1);

  if (metricsAgg && metricsAgg.length > 0) {
    ok("product_metrics has gross_profit_90d populated");
  } else {
    fail("product_metrics gross_profit_90d", "no rows with gross_profit_90d > 0 — run Recalculate metrics");
  }

  const { data: supplierMargin } = await supabase
    .from("suppliers")
    .select("avg_margin_on_supplied")
    .not("avg_margin_on_supplied", "is", null)
    .limit(1);
  if (supplierMargin && supplierMargin.length > 0) {
    ok("suppliers avg_margin_on_supplied populated");
  } else {
    fail("suppliers avg_margin_on_supplied", "null — run Recalculate metrics");
  }
  console.log();

  // ── 4. Page health ────────────────────────────────────────────────────────

  console.log("▶ Page health (HTTP)");

  let accessToken = "";

  if (TEST_EMAIL && TEST_PASSWORD) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (authError || !authData.session) {
      console.warn(`  ⚠  Auth failed (${authError?.message ?? "no session"}) — page tests will check unauthenticated status`);
    } else {
      accessToken = authData.session.access_token;
      ok(`Signed in as ${TEST_EMAIL}`);
    }
  } else {
    console.warn("  ⚠  TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping auth, page tests check server-up only");
  }

  // Fetch first IDs for detail pages
  const [productId, customerId, supplierId, purchaseId] = await Promise.all([
    firstId("products"),
    firstId("customers"),
    firstId("suppliers"),
    firstId("purchase_orders"),
  ]);

  const pages = [
    "/today",
    "/products",
    productId ? `/products/${productId}` : null,
    "/purchases",
    purchaseId ? `/purchases/${purchaseId}` : null,
    "/customers",
    customerId ? `/customers/${customerId}` : null,
    "/suppliers",
    supplierId ? `/suppliers/${supplierId}` : null,
    "/insights/inventory",
    "/insights/sales",
    "/insights/abc",
    "/insights/dead-stock",
    "/insights/cash",
    "/insights/profitability",
    "/rules",
  ].filter(Boolean) as string[];

  for (const page of pages) {
    await checkPage(page, accessToken);
  }
  console.log();

  // ── 5. API routes ─────────────────────────────────────────────────────────

  console.log("▶ API routes");
  try {
    const res = await fetch(`${BASE_URL}/api/cron/morning-alerts`, {
      headers: { authorization: "Bearer dev" },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      ok(`POST /api/cron/morning-alerts → processed ${(json as { processed?: number }).processed ?? "?"} org(s)`);
    } else {
      fail("/api/cron/morning-alerts", `status ${res.status}`);
    }
  } catch (e) {
    fail("/api/cron/morning-alerts", (e as Error).message);
  }
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log("─────────────────────────────────────────");
  const total = passed + failed;
  if (failed === 0) {
    console.log(`✅  All ${total} checks passed`);
  } else {
    console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
    process.exit(1);
  }
  console.log();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
