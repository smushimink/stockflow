"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 max-w-sm px-6">
        <p className="text-xs font-600 text-[#6B6B66] uppercase tracking-wider">StockFlow</p>
        <h2 className="text-xl font-600 text-[#1A1A17]">Something went wrong</h2>
        <p className="text-sm text-[#6B6B66]">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        {error.digest && (
          <p className="text-[10px] text-[#C8C8C4] font-mono">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-500 bg-[#1A1A17] text-white rounded-lg hover:bg-[#2D2D29] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
