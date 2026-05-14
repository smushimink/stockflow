import Link from "next/link";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export const metadata = {
  title: "Product Tour — ArachNet",
  description: "See how ArachNet turns your inventory and sales data into daily decisions.",
};

export default function TourPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-[#F7F7F5] pt-14">
        <div className="max-w-3xl mx-auto px-5 py-24 text-center">
          <p className="text-xs font-600 tracking-widest text-[#4D7B3D] uppercase mb-4">Coming soon</p>
          <h1 className="text-4xl font-700 text-[#1A1A17] tracking-tight mb-4">Product Tour</h1>
          <p className="text-[17px] text-[#5C5C57] leading-relaxed mb-10">
            An interactive walkthrough of ArachNet is in the works. In the meantime, sign up for early access and we&apos;ll walk you through it personally.
          </p>
          <Link
            href="/signup"
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-500 text-white"
            style={{ background: "#1A1A17" }}
          >
            Get early access
          </Link>
        </div>
      </main>
    </>
  );
}
