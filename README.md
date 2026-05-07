# StockFlow

Decision intelligence for wholesale and product-based businesses. Built on Next.js 15 App Router, Supabase (PostgreSQL + RLS), and Tailwind CSS.

## What it does

StockFlow answers the 5 real money questions of a wholesale business, in under 5 seconds per page:

| Question | Where |
|---|---|
| What should I stock? | `/today` → money lens + reorder alerts |
| Which suppliers are worth it? | `/suppliers/[id]` → Profitability tab |
| Which customers are profitable? | `/customers/[id]` → Profit section |
| How much inventory should I hold? | `/insights/cash` |
| Where is my cash getting stuck? | `/insights/dead-stock` |

## Screens

- **Today** — prioritised alert feed + 5-question money lens strip
- **Products** — active SKU table with ABC class badges and reorder status
- **Product detail** — 5 tabs: Pricing, Sales history (SVG bar chart), Reorder logic, Supplier, Activity
- **Purchases** — purchase order list with status filter chips
- **Purchase detail** — line items, receive goods, status transitions
- **Customers** — customer table with profit and churn risk indicators
- **Customer detail** — order timeline + real profit section + renegotiation banner
- **Suppliers** — supplier table with fill rate and score indicators
- **Supplier detail** — 5 tabs: Overview, Products, Purchase history, Performance, Profitability
- **Insights → Inventory** — stock health overview
- **Insights → Sales** — sales velocity and trends
- **Insights → ABC** — ABC classification breakdown
- **Insights → Dead stock** — idle inventory with cash-at-risk
- **Insights → Cash flow** — working capital donut, trapped cash table, DIO
- **Insights → Profitability** — profit mix by product / customer / supplier
- **Rules** — 9 configurable decision rules with live engine trigger
- **Cmd+K** — palette with product/customer/supplier search + quick actions

## Decision rules

| # | Rule | What it catches |
|---|---|---|
| 01 | Reorder point | Stock falling below minimum |
| 02 | Dead stock | SKUs idle > 60/90/180 days |
| 03 | ABC classification | Quarterly revenue-tier assignment |
| 04 | Real margin | Actual margin below threshold |
| 05 | Customer churn | Customers overdue by order interval |
| 06 | Supplier scorecard | Low on-time / fill rate suppliers |
| 07 | E-commerce pipeline | SKUs ready to list online |
| 08 | Seasonal pre-order | Upcoming demand spikes |
| 09 | Customer profitability | Low-margin, slow-payer, hidden gem customers |

## Getting started

```bash
npm install
npm run dev
```

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Database setup

```bash
# Apply migrations (Supabase dashboard → SQL editor, run in order)
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_materialized_views.sql
supabase/migrations/0004_decision_rules_schema.sql
supabase/migrations/0005_decision_functions.sql
supabase/migrations/0006_profit_metrics.sql
supabase/migrations/0007_customer_profit.sql
supabase/migrations/0008_supplier_profit.sql
supabase/migrations/0009_grant_rpc_functions.sql

# Seed demo data (Sydney Wholesale Demo org)
supabase/seed.sql
```

After seeding, open Rules → "Recalculate metrics" → "Run all rules now".

### Smoke test

```bash
TEST_USER_EMAIL=demo@example.com TEST_USER_PASSWORD=secret npx tsx scripts/smoke-test.ts
```

Requires the dev server running at `localhost:3000` and a test user created in Supabase auth. See `scripts/smoke-test.ts` for details.

## Tech stack

- **Next.js 15** App Router, server components, server actions
- **Supabase** PostgreSQL with RLS, PostgREST, SSR auth
- **Tailwind CSS v4** utility-first styling
- **shadcn/ui** — Button, Dialog, Sheet, Switch, Select, Command
- **cmdk** — Cmd+K command palette
- **sonner** — toast notifications
- **date-fns** — date arithmetic
- **zod** — schema validation
