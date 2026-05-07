function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E5E2] rounded${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

export default function TodayLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      {/* Hero header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton width="80px" height="12px" />
          <Skeleton width="220px" height="28px" />
          <Skeleton width="140px" height="14px" />
        </div>
        <div className="text-right space-y-2 shrink-0">
          <Skeleton width="100px" height="12px" />
          <Skeleton width="80px" height="16px" />
        </div>
      </div>

      {/* Money lens strip — 5 cards */}
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-[#E5E5E2] rounded-lg px-3 py-2.5 space-y-2"
          >
            <Skeleton width="70%" height="10px" />
            <Skeleton width="90%" height="12px" />
          </div>
        ))}
      </div>

      {/* Alert card skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 flex items-start gap-3"
          >
            <Skeleton width="8px" height="8px" className="rounded-full mt-1 shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton width="60%" height="14px" />
              <Skeleton width="85%" height="12px" />
            </div>
            <div className="shrink-0 space-y-1.5">
              <Skeleton width="64px" height="28px" className="rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
