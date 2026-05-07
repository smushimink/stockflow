import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stockflow — Daily decision intelligence for wholesale businesses",
  description:
    "Turn your inventory and sales data into a daily list of decisions: reorder, discount, follow up. Built for product businesses doing $1M-$20M.",
  openGraph: {
    title: "Stockflow — Daily decision intelligence for wholesale businesses",
    description:
      "Turn your inventory and sales data into a daily list of decisions: reorder, discount, follow up. Built for product businesses doing $1M-$20M.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Stockflow — Decision intelligence for product businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stockflow — Daily decision intelligence for wholesale businesses",
    description:
      "Turn your inventory and sales data into a daily list of decisions: reorder, discount, follow up. Built for product businesses doing $1M-$20M.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
