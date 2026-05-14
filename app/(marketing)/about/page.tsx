import Link from "next/link";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export const metadata = {
  title: "About — ArachNet",
  description: "We build decision intelligence for the businesses that keep supply chains moving.",
};

export default function AboutPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-[#F7F7F5] pt-14">
        <div className="max-w-3xl mx-auto px-5 py-24">
          <p className="text-xs font-600 tracking-widest text-[#4D7B3D] uppercase mb-4">Our story</p>
          <h1 className="text-4xl font-700 text-[#1A1A17] tracking-tight mb-6">About ArachNet</h1>
          <div className="space-y-5 text-[16px] text-[#5C5C57] leading-relaxed">
            <p>
              ArachNet started with a simple observation: wholesale and distribution businesses are sitting on
              oceans of data — purchase orders, sales history, customer records — but the decisions that matter
              still get made from a Monday-morning spreadsheet, a gut feel, or a frantic email chain.
            </p>
            <p>
              We built ArachNet to close that gap. Not by replacing your systems, but by reading them and
              giving you a ranked, plain-English list of what to do today.
            </p>
            <p>
              We&apos;re a small team with roots in supply-chain consulting, statistical modelling, and B2B SaaS.
              We work closely with customers doing $1M–$20M in product revenue, the segment most software companies
              ignore in favour of enterprise contracts or consumer apps.
            </p>
            <p>
              If that sounds like your business,{" "}
              <Link href="/signup" className="text-[#1A1A17] underline underline-offset-2 hover:text-[#4D7B3D]">
                we&apos;d love to have you try it.
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
