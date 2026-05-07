import { InsightsTabs } from "@/components/insights/insights-tabs";

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-600 text-[#1A1A17]">Insights</h1>
        <p className="text-sm text-[#6B6B66] mt-0.5">Inventory, sales, and product analytics</p>
      </div>
      <InsightsTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
