import { createAdminClient } from "@/lib/supabase/admin";
import type { Alert, DecisionRule, RuleContext } from "@/lib/decisions/types";
import { segmentsToText } from "@/lib/decisions/reasoning";
import type { ReasoningSegment } from "@/lib/decisions/reasoning";

interface SupplierScorecardConfig {
  lead_time_variance_threshold?: number;
  fill_rate_threshold?: number;
  on_time_rate_threshold?: number;
}

export const supplierScorecardRule: DecisionRule = {
  rule_type: "supplier_scorecard",
  defaultConfig: {
    lead_time_variance_threshold: 1.3,
    fill_rate_threshold: 0.9,
    on_time_rate_threshold: 0.8,
  },

  async evaluate({ orgId, config }: RuleContext): Promise<Alert[]> {
    const {
      lead_time_variance_threshold = 1.3,
      fill_rate_threshold = 0.9,
      on_time_rate_threshold = 0.8,
    } = config as SupplierScorecardConfig;

    const supabase = createAdminClient();

    const cutoff12mo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

    const [{ data: suppliers, error: sErr }, { data: pos, error: poErr }] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name, lead_time_days")
        .eq("organization_id", orgId)
        .eq("active", true),
      supabase
        .from("purchase_orders")
        .select(`
          id, supplier_id, status, created_at, received_at, expected_at,
          purchase_order_items ( qty_ordered, qty_received )
        `)
        .eq("organization_id", orgId)
        .gte("created_at", cutoff12mo),
    ]);

    if (sErr) throw sErr;
    if (poErr) throw poErr;

    // Group POs by supplier
    const poBySupplier = new Map<string, typeof pos>();
    for (const po of pos ?? []) {
      const sid = po.supplier_id as string;
      if (!sid) continue;
      if (!poBySupplier.has(sid)) poBySupplier.set(sid, []);
      poBySupplier.get(sid)!.push(po);
    }

    const alerts: Alert[] = [];

    for (const supplier of suppliers ?? []) {
      const supplierPos = poBySupplier.get(supplier.id as string) ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const received = supplierPos.filter((po: any) => po.status === "received");
      if (received.length === 0) continue;

      // Lead time: days between created_at and received_at
      const lead_times = received
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((po: any) => po.received_at && po.created_at)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((po: any) =>
          (new Date(po.received_at as string).getTime() - new Date(po.created_at as string).getTime()) /
          (24 * 3600 * 1000)
        );
      const avg_lead_time_real =
        lead_times.length > 0 ? lead_times.reduce((a, b) => a + b, 0) / lead_times.length : 0;
      const lead_time_variance =
        supplier.lead_time_days > 0 ? avg_lead_time_real / (supplier.lead_time_days as number) : 1;

      // Fill rate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totals = received.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc: { ordered: number; received_qty: number }, po: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items = (Array.isArray(po.purchase_order_items) ? po.purchase_order_items : [po.purchase_order_items]) as any[];
          for (const item of items) {
            if (!item) continue;
            acc.ordered += (item.qty_ordered as number) ?? 0;
            acc.received_qty += (item.qty_received as number) ?? 0;
          }
          return acc;
        },
        { ordered: 0, received_qty: 0 }
      );
      const fill_rate = totals.ordered > 0 ? totals.received_qty / totals.ordered : 1;

      // On-time rate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const withExpected = received.filter((po: any) => po.expected_at && po.received_at);
      const on_time_count = withExpected.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (po: any) => new Date(po.received_at as string) <= new Date(po.expected_at as string)
      ).length;
      const on_time_rate = withExpected.length > 0 ? on_time_count / withExpected.length : 1;

      const issues: string[] = [];
      if (lead_time_variance > lead_time_variance_threshold)
        issues.push(`lead time ${((lead_time_variance - 1) * 100).toFixed(0)}% over promised`);
      if (fill_rate < fill_rate_threshold)
        issues.push(`fill rate ${(fill_rate * 100).toFixed(0)}%`);
      if (on_time_rate < on_time_rate_threshold)
        issues.push(`on-time ${(on_time_rate * 100).toFixed(0)}%`);

      if (issues.length === 0) continue;

      const total_spend = received.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, po: any) => sum + ((po.total as number) ?? 0), 0
      );

      // ── Reasoning trail ──────────────────────────────────────────────────────

      const trail: ReasoningSegment[] = [
        {
          type: "historical",
          label: "Data foundation",
          text: `Analysis based on ${received.length} received POs over the last 12 months (total spend: $${Math.round(total_spend).toLocaleString("en-AU")}).`,
        },
        {
          type: "data",
          label: "Lead time",
          text: `Avg actual lead time: ${avg_lead_time_real.toFixed(1)}d vs promised ${supplier.lead_time_days}d (${((lead_time_variance - 1) * 100).toFixed(0)}% variance${lead_time_variance > lead_time_variance_threshold ? ` — exceeds ${((lead_time_variance_threshold - 1) * 100).toFixed(0)}% threshold` : ""}).`,
        },
        {
          type: "data",
          label: "Fill rate",
          text: `Fill rate: ${(fill_rate * 100).toFixed(0)}% (${totals.received_qty} of ${totals.ordered} units received)${fill_rate < fill_rate_threshold ? ` — below ${(fill_rate_threshold * 100).toFixed(0)}% threshold` : ""}.`,
        },
        {
          type: "data",
          label: "On-time rate",
          text: withExpected.length > 0
            ? `On-time delivery: ${(on_time_rate * 100).toFixed(0)}% (${on_time_count} of ${withExpected.length} POs)${on_time_rate < on_time_rate_threshold ? ` — below ${(on_time_rate_threshold * 100).toFixed(0)}% threshold` : ""}.`
            : `On-time rate: insufficient data (no expected dates recorded).`,
        },
        {
          type: "rule",
          label: "Thresholds",
          text: `Thresholds: on-time ≥ ${(on_time_rate_threshold * 100).toFixed(0)}%, fill rate ≥ ${(fill_rate_threshold * 100).toFixed(0)}%, lead time variance ≤ ${lead_time_variance_threshold}×.`,
        },
        {
          type: "verdict",
          label: "Trigger",
          text: `${issues.length} of 3 scorecard metrics below threshold: ${issues.join("; ")}.`,
        },
      ];

      alerts.push({
        organization_id: orgId,
        rule_type: "supplier_scorecard",
        related_supplier_id: supplier.id as string,
        severity: "yellow",
        title: `Supplier issue: ${supplier.name as string}`,
        summary: issues.join(" · "),
        reasoning: segmentsToText(trail),
        suggested_action: "Review supplier",
        metadata: {
          lead_time_variance: Math.round(lead_time_variance * 100) / 100,
          fill_rate: Math.round(fill_rate * 100) / 100,
          on_time_rate: Math.round(on_time_rate * 100) / 100,
          avg_lead_time_real: Math.round(avg_lead_time_real * 10) / 10,
          promised_lead_time: supplier.lead_time_days,
          total_orders: received.length,
          total_spend: Math.round(total_spend * 100) / 100,
          supplier_name: supplier.name,
          reasoning_trail: trail,
        },
      });
    }

    return alerts;
  },
};
