function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E5E2] rounded${className ? ` ${className}` : ""}`}
      style={{ width, height }}
    />
  );
}

export default function ProductDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <Skeleton width="52px" height="12px" />
        <Skeleton width="10px" height="10px" className="rounded-full" />
        <Skeleton width="120px" height="12px" />
      </div>

      {/* Header block */}
      <div className="space-y-2">
        <Skeleton width="240px" height="28px" />
        <div className="flex items-center gap-2">
          <Skeleton width="60px" height="14px" />
          <Skeleton width="6px" height="6px" className="rounded-full" />
          <Skeleton width="80px" height="14px" />
          <Skeleton width="52px" height="20px" className="rounded" />
        </div>
      </div>

      {/* 3 metric cards */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#E5E5E2] rounded-lg px-4 py-3 space-y-1.5">
            <Skeleton width="70%" height="12px" />
            <Skeleton width="55%" height="22px" />
            <Skeleton width="80%" height="12px" />
          </div>
        ))}
      </div>

      {/* Big tab card */}
      <div className="bg-white border border-[#E5E5E2] rounded-lg overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-[#E5E5E2] px-4 py-2 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="64px" height="14px" />
          ))}
        </div>
        {/* Content area */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton width="50%" height="12px" />
                <Skeleton width="70%" height="16px" />
              </div>
            ))}
          </div>
          <Skeleton width="100%" height="120px" className="rounded-lg" />
        </div>
      </div>
    </div>
  );
}
