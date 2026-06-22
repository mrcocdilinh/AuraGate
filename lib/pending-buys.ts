import { randomUUID } from "crypto";

interface PendingBuy {
  id: string;
  slug: string;
  price: string;
  sellerAddress: string;
  createdAt: number;
}

// Per-instance in-memory store. Fine for testnet demo where
// challenge + confirm happen within seconds in the same request cycle.
const g = globalThis as unknown as { __pending?: Map<string, PendingBuy> };
function store(): Map<string, PendingBuy> {
  if (!g.__pending) g.__pending = new Map();
  return g.__pending;
}

function prune() {
  const cutoff = Date.now() - 5 * 60_000; // 5-minute window
  for (const [k, v] of store()) {
    if (v.createdAt < cutoff) store().delete(k);
  }
}

export function createPendingBuy(slug: string, price: string, sellerAddress: string): string {
  prune();
  const id = randomUUID();
  store().set(id, { id, slug, price, sellerAddress, createdAt: Date.now() });
  return id;
}

/** Consume a pending buy (one-time, expires in 5 min). Returns null if invalid/expired. */
export function consumePendingBuy(id: string): PendingBuy | null {
  const buy = store().get(id);
  if (!buy) return null;
  if (Date.now() - buy.createdAt > 5 * 60_000) {
    store().delete(id);
    return null;
  }
  store().delete(id);
  return buy;
}
