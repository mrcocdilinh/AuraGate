/**
 * The 5 demo "fleet" agents shown on /fleet. Addresses only (no private keys) —
 * safe to import in the browser. The matching keys live in .env.agents.local
 * for the headless `npm run fleet` runner.
 *
 * These addresses are recognised by the x402 payment layer as demo payers, so
 * the in-browser fleet demo records receipts without moving real USDC — even
 * when the deployment runs in live mode.
 */
export interface FleetAgent {
  n: number;
  name: string;
  emoji: string;
  field: string;
  address: string;
  /** Service slugs this agent buys, in order. */
  slugs: string[];
  /** Tailwind accent token (without the `text-`/`bg-` prefix). */
  tint: "amber" | "mint" | "cyan" | "purple" | "primary";
  budget: number;
}

export const FLEET_AGENTS: FleetAgent[] = [
  {
    n: 1, name: "CryptoQuant", emoji: "🪙", field: "Crypto markets",
    address: "0x77533660a9638208a6668AC4CEBd3Bb88c868FC5", tint: "amber", budget: 0.05,
    slugs: ["oracle-check", "price-multi-exchange", "global-crypto", "sentiment", "mempool"],
  },
  {
    n: 2, name: "WallStreet", emoji: "📈", field: "Stocks · metals · FX",
    address: "0x2425a5c3a5acc0a3311F1086f2BaC224dBeA51F4", tint: "mint", budget: 0.05,
    slugs: ["stocks", "metals", "fx-rates", "fx-convert"],
  },
  {
    n: 3, name: "GeoScout", emoji: "🌍", field: "Weather · geo · world",
    address: "0xaFC16eF31556489A3dd0f8Cb712eca9f3A7e5968", tint: "cyan", budget: 0.05,
    slugs: ["weather", "forecast", "air-quality", "country-info", "timezone"],
  },
  {
    n: 4, name: "Scholar", emoji: "📚", field: "Knowledge · research",
    address: "0x4500c0AbcC9F621f4f3E17191C48Cd9a85482B15", tint: "purple", budget: 0.04,
    slugs: ["wikipedia", "dictionary", "quote", "holidays"],
  },
  {
    n: 5, name: "DevPulse", emoji: "💻", field: "Dev · tech · DeFi",
    address: "0x55C149077f3f91Eb82150cB29882ae461E5A6109", tint: "primary", budget: 0.06,
    slugs: ["news-tech", "npm-stats", "github-repo", "defi-tvl", "summarize"],
  },
];

/** Lowercased addresses, for the x402 demo-payer bypass. */
export const FLEET_ADDRESSES = FLEET_AGENTS.map((a) => a.address.toLowerCase());
