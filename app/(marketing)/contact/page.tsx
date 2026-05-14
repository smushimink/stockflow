import Link from "next/link";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export const metadata = {
  title: "Contact — ArachNet",
  description: "Get in touch with the ArachNet team.",
};

export default function ContactPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-[#F7F7F5] pt-14">
        <div className="max-w-3xl mx-auto px-5 py-24">
          <p className="text-xs font-600 tracking-widest text-[#4D7B3D] uppercase mb-4">Get in touch</p>
          <h1 className="text-4xl font-700 text-[#1A1A17] tracking-tight mb-6">Contact us</h1>
          <p className="text-[16px] text-[#5C5C57] leading-relaxed mb-10">
            We&apos;re a small team and we read every message. Whether you have a question about pricing,
            want a walkthrough, or just want to tell us what&apos;s broken in your current setup — reach out.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href="mailto:hello@getarachnet.com"
              className="p-5 rounded-xl border border-[#E5E5E2] bg-white hover:border-[#1A1A17] transition-colors"
            >
              <p className="text-xs font-600 text-[#9A9A93] uppercase tracking-widest mb-1">Email</p>
              <p className="text-[15px] font-500 text-[#1A1A17]">hello@getarachnet.com</p>
              <p className="text-[13px] text-[#5C5C57] mt-1">We reply within 1 business day</p>
            </a>
            <Link
              href="/signup"
              className="p-5 rounded-xl border border-[#E5E5E2] bg-white hover:border-[#1A1A17] transition-colors block"
            >
              <p className="text-xs font-600 text-[#9A9A93] uppercase tracking-widest mb-1">Start free</p>
              <p className="text-[15px] font-500 text-[#1A1A17]">Create an account</p>
              <p className="text-[13px] text-[#5C5C57] mt-1">No credit card required</p>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
