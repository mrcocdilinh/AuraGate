import { randomUUID } from "crypto";
import type { Payment, Receipt, Service } from "./types";
import { SEED_SERVICES } from "./services-seed";

// ─── Backend selection ───────────────────────────────────────────────────
// When Vercel KV is connected, KV_REST_API_URL + KV_REST_API_TOKEN are injected
// automatically. Locally (or before KV is added) we fall back to in-memory.
const USE_KV = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

async function kv() {
  const { kv: client } = await import("@vercel/kv");
  return client;
}

// ─── In-memory fallback ───────────────────────────────────────────────────
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

// ─── Services ─────────────────────────────────────────────────────────────────
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

// ─── Payments ─────────────────────────────────────────────────────────────────
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

// ─── Receipts ─────────────────────────────────────────────────────────────────
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
