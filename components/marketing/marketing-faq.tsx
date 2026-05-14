"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How is this different from my inventory management software (Cin7, Unleashed, DEAR)?",
    a: "Those tools track inventory. ArachNet makes decisions about it. Most customers keep their existing IMS and add ArachNet on top — we read from it, not replace it.",
  },
  {
    q: "Do you connect to my accounting?",
    a: "Yes. Xero and MYOB are supported with read-only OAuth. We use accounting data to compute real margins and detect slow-paying customers.",
  },
  {
    q: "What if my data is messy?",
    a: "That's the normal starting point. Our CSV importer auto-maps columns even when names are in Spanish, Mandarin, or freestyle. We flag low-confidence rows for you to review.",
  },
  {
    q: "Will you replace my warehouse staff or accountant?",
    a: "No. We replace the spreadsheet they email you on Monday morning. Your team still runs the warehouse — they just get a clearer list of what to do today.",
  },
  {
    q: "How accurate is the forecasting?",
    a: "We don't promise magic. We use transparent statistics — moving averages, regression on your price history, ABC-XYZ classification — and we always show the math behind each recommendation. Confidence indicators are honest. If we don't have enough data, we say so.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You can export everything to CSV anytime. After cancellation we delete your data within 30 days unless you request otherwise. We never sell or share your data with anyone.",
  },
  {
    q: "Can I run it on my own server?",
    a: "Not yet. We're cloud-only with EU/AU regional hosting. Self-hosting is on the roadmap for Business plan customers.",
  },
];

export function MarketingFaq() {
  return (
    <Accordion type="single" collapsible className="space-y-0">
      {FAQS.map((faq, i) => (
        <AccordionItem
          key={i}
          value={`item-${i}`}
          className="border-b border-[#E5E5E2] last:border-0"
        >
          <AccordionTrigger className="text-left text-[15px] font-500 text-[#1A1A17] hover:no-underline py-4 hover:text-[#1A1A17]">
            {faq.q}
          </AccordionTrigger>
          <AccordionContent className="text-[14px] text-[#5C5C57] leading-relaxed pb-4">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
