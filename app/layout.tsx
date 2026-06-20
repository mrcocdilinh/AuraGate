import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { TestnetBanner } from "@/components/testnet-banner";

export const metadata: Metadata = {
  title: "AuraGate — The gateway for AI agents to move value.",
  description:
    "AI agent payments gateway built on stablecoin rails. Discover & pay for AI services via x402 nanopayments on Arc — no API keys, no subscriptions, just USDC.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: { url: "/apple-icon.png", sizes: "256x256", type: "image/png" },
  },
  openGraph: {
    title: "AuraGate — The gateway for AI agents to move value.",
    description: "AI agent payments gateway built on stablecoin rails.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraGate — The gateway for AI agents to move value.",
    description: "AI agent payments gateway built on stablecoin rails.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#030A18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <WalletProvider>
          <TestnetBanner />
          <Nav />
          <main>{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
