function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E5E2] rounded${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

export default function PurchasesLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton width="180px" height="28px" />
          <Skeleton width="140px" height="14px" />
        </div>
        <Skeleton width="88px" height="36px" className="rounded-lg" />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="80px" height="30px" className="rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="border-b border-[#E5E5E2] px-4 py-2.5 grid grid-cols-8 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} width="60%" height="10px" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-[#E5E5E2] last:border-0 px-4 py-3 grid grid-cols-8 gap-4 items-center"
          >
            {/* Order # */}
            <Skeleton width="64px" height="14px" />
            {/* Supplier */}
            <Skeleton width="80px" height="14px" />
            {/* Items */}
            <Skeleton width="24px" height="14px" className="mx-auto" />
            {/* Subtotal */}
            <Skeleton width="52px" height="14px" className="ml-auto" />
            {/* Total */}
            <Skeleton width="60px" height="14px" className="ml-auto" />
            {/* Expected */}
            <Skeleton width="56px" height="14px" />
            {/* Status badge */}
            <Skeleton width="72px" height="20px" className="rounded-full" />
            {/* View */}
            <Skeleton width="36px" height="14px" className="ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
