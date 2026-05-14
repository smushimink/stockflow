import type { Metadata } from "next";
import { DM_Serif_Text, Instrument_Sans } from "next/font/google";

const dmSerif = DM_Serif_Text({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArachNet — Know what to buy. Know what to cut.",
  description:
    "Turn your inventory and sales data into a daily list of decisions: reorder, discount, follow up. Built for product businesses doing $1M–$20M.",
  openGraph: {
    title: "ArachNet — Know what to buy. Know what to cut.",
    description:
      "Turn your inventory and sales data into a daily list of decisions: reorder, discount, follow up. Built for product businesses doing $1M–$20M.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ArachNet — Decision intelligence for product businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ArachNet — Know what to buy. Know what to cut.",
    description:
      "Turn your inventory and sales data into a daily list of decisions: reorder, discount, follow up. Built for product businesses doing $1M–$20M.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${dmSerif.variable} ${instrumentSans.variable}`}
      style={{
        fontFamily: "var(--font-instrument), -apple-system, sans-serif",
        background: "#FEFDFB",
        color: "#18170F",
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      {children}
    </div>
  );
}
