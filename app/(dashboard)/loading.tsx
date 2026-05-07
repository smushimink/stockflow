export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#E5E5E2] border-t-[#1A1A17] animate-spin" />
        <p className="text-xs text-[#6B6B66]">Loading…</p>
      </div>
    </div>
  );
}
