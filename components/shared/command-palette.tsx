"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { recalculateMetrics } from "@/app/(dashboard)/rules/recalculate/action";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Truck,
  Settings2,
  Plug,
  BarChart2,
  RefreshCw,
  Play,
  Tag,
  Clock,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchRow {
  id: string;
  name: string;
  subtitle?: string;
  href: string;
}

interface RecentItem {
  type: "product" | "customer" | "supplier";
  id: string;
  name: string;
  subtitle?: string;
  href: string;
}

// ── Recent localStorage helpers ──────────────────────────────────────────────

const RECENT_KEY = "arachnet:recent";
const RECENT_MAX = 5;

function readRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(item: RecentItem) {
  const existing = readRecent().filter((r) => r.href !== item.href);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...existing].slice(0, RECENT_MAX)));
}

// ── Navigate items ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/sales", label: "Sales", icon: TrendingUp },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/insights/inventory", label: "Insights → Inventory", icon: BarChart2 },
  { href: "/insights/sales", label: "Insights → Sales", icon: BarChart2 },
  { href: "/insights/abc", label: "Insights → ABC classification", icon: BarChart2 },
  { href: "/insights/dead-stock", label: "Insights → Dead stock", icon: BarChart2 },
  { href: "/insights/cash", label: "Insights → Cash flow", icon: BarChart2 },
  { href: "/insights/profitability", label: "Insights → Profitability", icon: BarChart2 },
  { href: "/rules", label: "Rules & engine", icon: Settings2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

function matchesQuery(label: string, q: string): boolean {
  return label.toLowerCase().includes(q.toLowerCase());
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  orgId?: string;
}

export function CommandPalette({ orgId: _orgId }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [products, setProducts] = useState<SearchRow[]>([]);
  const [customers, setCustomers] = useState<SearchRow[]>([]);
  const [suppliers, setSuppliers] = useState<SearchRow[]>([]);
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const supabase = createClient();

  // Load recent on open
  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  // Cmd+K toggle
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clear search results when closed
  useEffect(() => {
    if (!open) {
      setQuery("");
      setProducts([]);
      setCustomers([]);
      setSuppliers([]);
    }
  }, [open]);

  // Async search — debounced
  useEffect(() => {
    if (query.length < 2) {
      setProducts([]);
      setCustomers([]);
      setSuppliers([]);
      return;
    }
    const timer = setTimeout(async () => {
      const q = `%${query}%`;
      const [{ data: pData }, { data: cData }, { data: sData }] = await Promise.all([
        supabase
          .from("products")
          .select("id, sku, name")
          .or(`sku.ilike.${q},name.ilike.${q}`)
          .eq("status", "active")
          .limit(6),
        supabase
          .from("customers")
          .select("id, name, company")
          .or(`name.ilike.${q},company.ilike.${q}`)
          .eq("active", true)
          .limit(5),
        supabase
          .from("suppliers")
          .select("id, name")
          .ilike("name", q)
          .eq("active", true)
          .limit(4),
      ]);
      setProducts(
        (pData ?? []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
          subtitle: p.sku as string,
          href: `/products/${p.id}`,
        }))
      );
      setCustomers(
        (cData ?? []).map((c) => ({
          id: c.id as string,
          name: c.name as string,
          subtitle: (c.company as string | null) ?? undefined,
          href: `/customers/${c.id}`,
        }))
      );
      setSuppliers(
        (sData ?? []).map((s) => ({
          id: s.id as string,
          name: s.name as string,
          href: `/suppliers/${s.id}`,
        }))
      );
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Navigate with optional recent tracking
  const go = useCallback(
    (href: string, recent?: Omit<RecentItem, "href">) => {
      setOpen(false);
      if (recent) pushRecent({ ...recent, href });
      router.push(href);
    },
    [router]
  );

  // ── Quick actions ─────────────────────────────────────────────────────────

  async function actionRecalculate() {
    setOpen(false);
    const toastId = toast.loading("Recalculating metrics…");
    const result = await recalculateMetrics();
    if ("error" in result) {
      toast.error(result.error, { id: toastId });
    } else {
      toast.success(
        `Done in ${result.duration_ms}ms · ${result.products_updated} products · ${result.suppliers_updated} suppliers`,
        { id: toastId, duration: 5000 }
      );
    }
  }

  async function actionRunRules() {
    setOpen(false);
    const toastId = toast.loading("Running all rules…");
    try {
      const res = await fetch("/api/cron/morning-alerts", {
        headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "dev"}` },
      });
      const data = await res.json();
      toast.success(
        `Done · ${data.results?.[0]?.newAlerts ?? 0} new alerts generated`,
        { id: toastId, duration: 5000 }
      );
    } catch {
      toast.error("Failed to run rules", { id: toastId });
    }
  }

  async function actionApplyDeadStockDiscount() {
    setOpen(false);
    const toastId = toast.loading("Finding dead stock…");
    try {
      const { data: deadMetrics } = await supabase
        .from("product_metrics")
        .select("product_id")
        .not("days_since_last_sale", "is", null)
        .gte("days_since_last_sale", 180);

      const ids = (deadMetrics ?? []).map((m) => m.product_id as string);
      if (ids.length === 0) {
        toast.info("No dead stock found (no SKUs idle ≥ 180 days)", { id: toastId });
        return;
      }

      toast.loading(`Applying 50% discount to ${ids.length} SKU${ids.length !== 1 ? "s" : ""}…`, { id: toastId });

      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_ids: ids, action: "discount50" }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Bulk action failed", { id: toastId });
      } else {
        toast.success(`50% discount applied to ${data.updated} SKU${data.updated !== 1 ? "s" : ""}`, {
          id: toastId,
          duration: 5000,
        });
      }
    } catch {
      toast.error("Failed to apply discount", { id: toastId });
    }
  }

  const QUICK_ACTIONS = [
    {
      id: "recalculate",
      label: "Recalculate metrics",
      keywords: ["recalc", "metrics", "refresh", "update"],
      icon: RefreshCw,
      shortcut: null as string | null,
      action: actionRecalculate,
    },
    {
      id: "run-rules",
      label: "Run all rules now",
      keywords: ["rules", "alerts", "engine", "run"],
      icon: Play,
      shortcut: null as string | null,
      action: actionRunRules,
    },
    {
      id: "dead-discount",
      label: "Apply 50% discount to dead stock",
      keywords: ["discount", "dead", "stock", "sale", "clearance"],
      icon: Tag,
      shortcut: null as string | null,
      action: actionApplyDeadStockDiscount,
    },
    {
      id: "nav-inventory",
      label: "Open Insights → Inventory",
      keywords: ["insights", "inventory", "stock"],
      icon: BarChart2,
      shortcut: null as string | null,
      action: () => go("/insights/inventory"),
    },
  ];

  const filteredActions =
    query.length === 0
      ? QUICK_ACTIONS
      : QUICK_ACTIONS.filter(
          (a) =>
            matchesQuery(a.label, query) ||
            a.keywords.some((k) => k.includes(query.toLowerCase()))
        );

  const filteredNav =
    query.length === 0
      ? NAV_ITEMS
      : NAV_ITEMS.filter((n) => matchesQuery(n.label, query));

  const hasResults =
    filteredActions.length > 0 ||
    filteredNav.length > 0 ||
    products.length > 0 ||
    customers.length > 0 ||
    suppliers.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search products, customers, or type a command…"
        onValueChange={setQuery}
        value={query}
      />
      <CommandList className="max-h-[420px]">
        {!hasResults && <CommandEmpty>No results for "{query}"</CommandEmpty>}

        {/* Recent — only when no query */}
        {query.length === 0 && recent.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recent.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => go(item.href)}
                  className="gap-2"
                >
                  <Clock size={13} className="text-[#6B6B66] shrink-0" />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.subtitle && (
                    <span className="text-xs text-[#6B6B66] shrink-0">{item.subtitle}</span>
                  )}
                  <span className="text-[10px] text-[#6B6B66] shrink-0 capitalize">{item.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick actions */}
        {filteredActions.length > 0 && (
          <>
            <CommandGroup heading="Quick actions">
              {filteredActions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    value={action.label}
                    onSelect={action.action}
                    className="gap-2"
                    disabled={isPending}
                  >
                    <Icon size={13} className="text-[#6B6B66] shrink-0" />
                    <span className="flex-1">{action.label}</span>
                    {action.shortcut && (
                      <CommandShortcut>{action.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigate */}
        {filteredNav.length > 0 && (
          <>
            <CommandGroup heading="Navigate">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    onSelect={() => go(item.href)}
                    className="gap-2"
                  >
                    <Icon size={13} className="text-[#6B6B66] shrink-0" />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* Products search */}
        {products.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`product-${p.id}-${p.name}`}
                  onSelect={() =>
                    go(p.href, { type: "product", id: p.id, name: p.name, subtitle: p.subtitle })
                  }
                  className="gap-2"
                >
                  <Package size={13} className="text-[#6B6B66] shrink-0" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.subtitle && (
                    <span className="text-xs text-[#6B6B66] shrink-0 font-mono">{p.subtitle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Customers search */}
        {customers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Customers">
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`customer-${c.id}-${c.name}`}
                  onSelect={() =>
                    go(c.href, { type: "customer", id: c.id, name: c.name, subtitle: c.subtitle })
                  }
                  className="gap-2"
                >
                  <Users size={13} className="text-[#6B6B66] shrink-0" />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.subtitle && (
                    <span className="text-xs text-[#6B6B66] shrink-0 truncate">{c.subtitle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Suppliers search */}
        {suppliers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Suppliers">
              {suppliers.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`supplier-${s.id}-${s.name}`}
                  onSelect={() =>
                    go(s.href, { type: "supplier", id: s.id, name: s.name })
                  }
                  className="gap-2"
                >
                  <Truck size={13} className="text-[#6B6B66] shrink-0" />
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
