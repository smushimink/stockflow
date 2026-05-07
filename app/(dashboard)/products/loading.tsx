function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E5E2] rounded${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

export default function ProductsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <Skeleton width="120px" height="28px" />

      {/* Overview bar — 4 stat cells */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-2">
            <Skeleton width="80%" height="12px" />
            <Skeleton width="50%" height="24px" />
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width="90px" height="28px" className="rounded-full" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#E5E5E2] overflow-hidden">
        {/* Header row */}
        <div className="border-b border-[#E5E5E2] px-4 py-2.5 grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} width="60%" height="10px" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-[#E5E5E2] last:border-0 px-4 py-3 grid grid-cols-7 gap-4 items-center"
          >
            <div className="space-y-1.5">
              <Skeleton width="70%" height="14px" />
              <Skeleton width="50%" height="11px" />
            </div>
            <Skeleton width="40px" height="14px" className="ml-auto" />
            <Skeleton width="36px" height="14px" className="ml-auto" />
            <div className="flex items-center justify-center gap-1.5">
              <Skeleton width="6px" height="6px" className="rounded-full" />
              <Skeleton width="50px" height="12px" />
            </div>
            <Skeleton width="40px" height="14px" className="ml-auto" />
            <Skeleton width="24px" height="20px" className="mx-auto" />
            <Skeleton width="32px" height="14px" className="ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
