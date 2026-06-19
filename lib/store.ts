import { randomUUID } from "crypto";
import type { Payment, Receipt, Service, SellerStats } from "./types";
import { SEED_SERVICES } from "./services-seed";

// ─── Backend selection ───────────────────────────────────────────────────────────────────────────────
// When Vercel KV is connected, KV_REST_API_URL + KV_REST_API_TOKEN are injected
// automatically. Locally (or before KV is added) we fall back to in-memory.
const USE_KV = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

async function kv() {
  const { kv: client } = await import("@vercel/kv");
  return client;
}

// ─── In-memory fallback ─────────────────────────────────────────────────────────────────────────────────
interface DB {
  services: Service[];
  payments: Payment[];
  receipts: Receipt[];
}
const g = globalThis as unknown as { __ag?: DB };
function mem(): DB {
  if (!g.__ag)
    g.__ag = {
      services: structuredClone(SEED_SERVICES),
      payments: [],
      receipts: [],
    };
  return g.__ag;
}

// ─── Services ────────────────────────────────────────────────────────────────────────────────────────
async function getAllServices(): Promise<Service[]> {
  if (USE_KV) {
    const k = await kv();
    const data = await k.get<Service[]>("ag:services");
    if (!data) {
      const seeded = structuredClone(SEED_SERVICES) as Service[];
      await k.set("ag:services", seeded);
      return seeded;
    }
    return data;
  }
  return mem().services;
}

export async function listServices(): Promise<Service[]> {
  return (await getAllServices()).filter((s) => s.active);
}

export async function getService(slug: string): Promise<Service | undefined> {
  return (await getAllServices()).find((s) => s.slug === slug);
}

export async function addService(
  input: Omit<Service, "createdAt" | "active" | "sampleResponse"> & {
    sampleResponse?: unknown;
  }
): Promise<Service> {
  const svc: Service = {
    ...input,
    sampleResponse: input.sampleResponse ?? { ok: true },
    active: true,
    createdAt: new Date().toISOString(),
  };
  if (USE_KV) {
    const k = await kv();
    const services = await getAllServices();
    services.unshift(svc);
    await k.set("ag:services", services);
  } else {
    mem().services.unshift(svc);
  }
  return svc;
}

async function writeAllServices(services: Service[]): Promise<void> {
  if (USE_KV) {
    const k = await kv();
    await k.set("ag:services", services);
  } else {
    mem().services = services;
  }
}

/** Toggle a service active/inactive. Returns the updated service. */
export async function setServiceActive(
  slug: string,
  active: boolean
): Promise<Service | undefined> {
  const services = await getAllServices();
  const svc = services.find((s) => s.slug === slug);
  if (!svc) return undefined;
  svc.active = active;
  await writeAllServices(services);
  return svc;
}

/** Remove a service from the registry. Returns true when one was deleted. */
export async function deleteService(slug: string): Promise<boolean> {
  const services = await getAllServices();
  const next = services.filter((s) => s.slug !== slug);
  if (next.length === services.length) return false;
  await writeAllServices(next);
  return true;
}

// ─── Payments ───────────────────────────────────────────────────────────────────────────────────────
export async function recordPayment(
  p: Omit<Payment, "id" | "createdAt">
): Promise<Payment> {
  const payment: Payment = {
    ...p,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (USE_KV) {
    const k = await kv();
    await k.lpush("ag:payments", payment);
    await k.ltrim("ag:payments", 0, 999);
  } else {
    mem().payments.unshift(payment);
  }
  return payment;
}

export async function listPayments(): Promise<Payment[]> {
  if (USE_KV) {
    const k = await kv();
    return k.lrange<Payment>("ag:payments", 0, 99);
  }
  return mem().payments;
}

// ─── Receipts ───────────────────────────────────────────────────────────────────────────────────────
export async function recordReceipt(
  r: Omit<Receipt, "id" | "createdAt">
): Promise<Receipt> {
  const receipt: Receipt = {
    ...r,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (USE_KV) {
    const k = await kv();
    await k.lpush("ag:receipts", receipt);
    await k.ltrim("ag:receipts", 0, 999);
  } else {
    mem().receipts.unshift(receipt);
  }
  return receipt;
}

export async function listReceipts(): Promise<Receipt[]> {
  if (USE_KV) {
    const k = await kv();
    return k.lrange<Receipt>("ag:receipts", 0, 99);
  }
  return mem().receipts;
}

export async function updateReceiptOnchainTx(
  id: string,
  onchainTx: string
): Promise<void> {
  if (USE_KV) {
    const k = await kv();
    const receipts = await k.lrange<Receipt>("ag:receipts", 0, -1);
    const idx = receipts.findIndex((r) => r.id === id);
    if (idx === -1) return;
    receipts[idx] = { ...receipts[idx], onchainTx };
    await k.del("ag:receipts");
    for (let i = receipts.length - 1; i >= 0; i--) {
      await k.lpush("ag:receipts", receipts[i]);
    }
  } else {
    const r = mem().receipts.find((r) => r.id === id);
    if (r) r.onchainTx = onchainTx;
  }
}

export async function rateReceipt(
  id: string,
  rating: number
): Promise<Receipt | undefined> {
  const stars = Math.max(1, Math.min(5, Math.round(rating)));
  if (USE_KV) {
    const k = await kv();
    const receipts = await k.lrange<Receipt>("ag:receipts", 0, -1);
    const idx = receipts.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    receipts[idx] = { ...receipts[idx], rating: stars };
    // Rebuild list with updated entry
    await k.del("ag:receipts");
    for (let i = receipts.length - 1; i >= 0; i--) {
      await k.lpush("ag:receipts", receipts[i]);
    }
    return receipts[idx];
  }
  const receipt = mem().receipts.find((r) => r.id === id);
  if (receipt) receipt.rating = stars;
  return receipt;
}

// ─── Reputation ────────────────────────────────────────────────────────────────────────────────────
/**
 * Aggregate per-seller reputation from services + receipts. The composite
 * `reputation` score (0–100) blends rating quality, demand (calls) and how much
 * of the catalog is health-checked — the trust signal Circle's curated
 * marketplace doesn't expose.
 */
export async function getSellers(): Promise<SellerStats[]> {
  const [services, receipts] = await Promise.all([
    getAllServices(),
    listReceipts(),
  ]);

  const slugToSeller = new Map<string, { address: string; name: string }>();
  for (const s of services) {
    slugToSeller.set(s.slug, { address: s.sellerAddress, name: s.sellerName });
  }

  type Acc = Omit<SellerStats, "reputation"> & { ratingSum: number };
  const map = new Map<string, Acc>();

  const ensure = (address: string, name: string, createdAt: string): Acc => {
    let a = map.get(address);
    if (!a) {
      a = {
        address,
        name,
        services: 0,
        calls: 0,
        revenue: 0,
        avgRating: null,
        ratedCount: 0,
        verifiedServices: 0,
        firstSeen: createdAt,
        ratingSum: 0,
      };
      map.set(address, a);
    }
    return a;
  };

  for (const s of services) {
    const a = ensure(s.sellerAddress, s.sellerName, s.createdAt);
    a.services += 1;
    if (s.verified) a.verifiedServices += 1;
    if (s.createdAt < a.firstSeen) a.firstSeen = s.createdAt;
  }

  for (const r of receipts) {
    const owner = slugToSeller.get(r.serviceSlug);
    if (!owner) continue;
    const a = ensure(owner.address, owner.name, r.createdAt);
    a.calls += 1;
    a.revenue += Number(r.amount);
    if (r.rating) {
      a.ratingSum += r.rating;
      a.ratedCount += 1;
    }
  }

  return [...map.values()]
    .map((a) => {
      const avgRating = a.ratedCount > 0 ? a.ratingSum / a.ratedCount : null;
      // Composite: rating (50%) + demand (30%) + verified coverage (20%).
      const ratingScore = avgRating !== null ? (avgRating / 5) * 50 : 20;
      const demandScore = Math.min(a.calls / 50, 1) * 30;
      const verifiedScore =
        a.services > 0 ? (a.verifiedServices / a.services) * 20 : 0;
      const reputation = Math.round(ratingScore + demandScore + verifiedScore);
      return {
        address: a.address,
        name: a.name,
        services: a.services,
        calls: a.calls,
        revenue: a.revenue,
        avgRating,
        ratedCount: a.ratedCount,
        verifiedServices: a.verifiedServices,
        reputation,
        firstSeen: a.firstSeen,
      } satisfies SellerStats;
    })
    .sort((a, b) => b.reputation - a.reputation || b.revenue - a.revenue);
}
