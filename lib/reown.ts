import { defineChain } from "viem";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: process.env.NEXT_PUBLIC_ARC_EXPLORER ?? "https://testnet.arcscan.app" },
  },
});

export const PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

export const wagmiAdapter = new WagmiAdapter({
  networks: [arcTestnet],
  projectId: PROJECT_ID,
});

// Eve Wallet — update id/homepage/links from Reown explorer (explorer.reown.com)
const EVE_WALLET = {
  id: "eve-wallet",
  name: "Eve Wallet",
  homepage: "https://evewallet.xyz",
  image_url: "https://evewallet.xyz/logo.png",
  mobile_link: "eve://",
  desktop_link: "https://evewallet.xyz",
};

let _modal: unknown = null;

export async function getModal() {
  if (typeof window === "undefined") return null;
  if (_modal) return _modal;
  // Dynamic import keeps @reown/appkit/react out of the server bundle
  const { createAppKit } = await import("@reown/appkit/react");
  _modal = createAppKit({
    adapters: [wagmiAdapter],
    networks: [arcTestnet],
    projectId: PROJECT_ID,
    metadata: {
      name: "AuraGate",
      description: "Payment marketplace for AI agents on Arc",
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://auragate.app",
      icons: ["https://auragate.app/icon-192.png"],
    },
    customWallets: [EVE_WALLET],
    features: {
      email: false,
      socials: [],
      analytics: false,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#3E73FF",
      "--w3m-border-radius-master": "12px",
      "--w3m-color-mix": "#030A18",
      "--w3m-color-mix-strength": 40,
      "--w3m-font-size-master": "13px",
    },
  });
  return _modal;
}
