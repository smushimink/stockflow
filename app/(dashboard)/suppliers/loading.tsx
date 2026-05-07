function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E5E2] rounded${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

export default function SuppliersLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton width="110px" height="28px" />
        <Skeleton width="112px" height="36px" className="rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
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
            {/* Supplier name + code */}
            <div className="space-y-1.5">
              <Skeleton width="70%" height="14px" />
              <Skeleton width="40%" height="11px" />
            </div>
            {/* Contact */}
            <div className="space-y-1.5">
              <Skeleton width="60%" height="14px" />
              <Skeleton width="80%" height="11px" />
            </div>
            {/* Lead time */}
            <Skeleton width="32px" height="14px" className="ml-auto" />
            {/* Active POs */}
            <Skeleton width="24px" height="14px" className="ml-auto" />
            {/* 90d spend */}
            <Skeleton width="56px" height="14px" className="ml-auto" />
            {/* Score dot */}
            <Skeleton width="10px" height="10px" className="rounded-full mx-auto" />
            {/* View link */}
            <Skeleton width="36px" height="14px" className="ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
