function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E5E2] rounded${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

export default function InsightsLoading() {
  // The insights layout already renders the heading and tab bar.
  // This skeleton covers just the content area below the tabs.
  return (
    <div className="space-y-5">
      {/* Summary stat row */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-2">
            <Skeleton width="75%" height="12px" />
            <Skeleton width="50%" height="22px" />
          </div>
        ))}
      </div>

      {/* Main content card */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        {/* Card header */}
        <div className="border-b border-[#E5E5E2] px-4 py-3 flex items-center justify-between">
          <Skeleton width="140px" height="16px" />
          <Skeleton width="80px" height="28px" className="rounded-lg" />
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-[#E5E5E2] last:border-0 px-4 py-3 flex items-center gap-4"
          >
            <Skeleton width="28px" height="28px" className="rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton width="45%" height="14px" />
              <Skeleton width="30%" height="11px" />
            </div>
            <Skeleton width="60px" height="14px" />
            <Skeleton width="48px" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
