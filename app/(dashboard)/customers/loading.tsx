function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E5E2] rounded${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

export default function CustomersLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <Skeleton width="130px" height="28px" />

      {/* Filter chips */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width="80px" height="30px" className="rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="border-b border-[#E5E5E2] px-4 py-2.5 grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="60%" height="10px" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-[#E5E5E2] last:border-0 px-4 py-3 grid grid-cols-6 gap-4 items-center"
          >
            <div className="space-y-1.5">
              <Skeleton width="65%" height="14px" />
              <Skeleton width="45%" height="11px" />
            </div>
            <Skeleton width="32px" height="14px" className="ml-auto" />
            <Skeleton width="56px" height="14px" className="ml-auto" />
            <Skeleton width="72px" height="14px" className="ml-auto" />
            <Skeleton width="10px" height="10px" className="rounded-full mx-auto" />
            <Skeleton width="36px" height="14px" className="ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
