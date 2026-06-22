import type { Receipt } from "./types";

/**
 * Demo receipts so the Receipt Explorer and Sellers leaderboard show real
 * activity on first load. These are testnet/mock settlements — payer addresses
 * are sample agent wallets, not real funds. Replaced by genuine receipts as
 * soon as live payments flow.
 */
export const SEED_RECEIPTS: Omit<Receipt, "id" | "createdAt">[] = [
  {
    paymentId: "seed-1",
    serviceSlug: "oracle-check",
    payer: "0xAAAEE8880C73a00cACe246B9445C62B77506b9b2",
    amount: "0.005",
    resultHash: "0x9f2c4a1b7e3d6058c4b2a1f0e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c5b4",
    rating: 5,
  },
  {
    paymentId: "seed-2",
    serviceSlug: "oracle-check",
    payer: "0xB0b1234567890aBcdef1234567890AbCdEf123456",
    amount: "0.005",
    resultHash: "0x3a1f0e8d7c6b5a49382716054e3d2c1b0a9f8e7d6c5b4a39281706f5e4d3c2b1",
    rating: 4,
  },
  {
    paymentId: "seed-3",
    serviceSlug: "dataset",
    payer: "0xC0ffee2547890aBcDef1234567890abcdEF345678",
    amount: "0.001",
    resultHash: "0x7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7",
    rating: 5,
  },
  {
    paymentId: "seed-4",
    serviceSlug: "sentiment",
    payer: "0xD15c0AbC1234567890abCDef1234567890aBcDeF1",
    amount: "0.002",
    resultHash: "0x5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5",
    rating: 5,
  },
  {
    paymentId: "seed-5",
    serviceSlug: "summarize",
    payer: "0xE5712890aBCdEf1234567890ABcDEf1234567890a",
    amount: "0.02",
    resultHash: "0x1a09f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1",
    rating: 4,
  },
];
