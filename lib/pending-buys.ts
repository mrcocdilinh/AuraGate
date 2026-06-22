import { randomUUID } from "crypto";
import { db } from "./supabase";

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

export async function createPendingBuy(slug: string, price: string, sellerAddress: string): Promise<string> {
  prune();
  const id = randomUUID();
  if (db) {
    const { error } = await db.from("pending_buys").insert({
      id,
      slug,
      price,
      seller_address: sellerAddress,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (error) throw error;
    return id;
  }
  store().set(id, { id, slug, price, sellerAddress, createdAt: Date.now() });
  return id;
}

/** Consume a pending buy (one-time, expires in 5 min). Returns null if invalid/expired. */
export async function consumePendingBuy(id: string): Promise<PendingBuy | null> {
  if (db) {
    const { data } = await db.from("pending_buys").select("*").eq("id", id).single();
    if (!data) return null;
    await db.from("pending_buys").delete().eq("id", id);
    if (Date.parse(data.expires_at) < Date.now()) return null;
    return {
      id: data.id,
      slug: data.slug,
      price: data.price,
      sellerAddress: data.seller_address,
      createdAt: Date.parse(data.created_at),
    };
  }
  const buy = store().get(id);
  if (!buy) return null;
  if (Date.now() - buy.createdAt > 5 * 60_000) {
    store().delete(id);
    return null;
  }
  store().delete(id);
  return buy;
}
