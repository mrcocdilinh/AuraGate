import { randomUUID } from "crypto";
import type { Payment, Receipt, Service } from "./types";
import { SEED_SERVICES } from "./services-seed";

interface DB {
  services: Service[];
  payments: Payment[];
  receipts: Receipt[];
}

const g = globalThis as unknown as { __auragate?: DB };

function db(): DB {
  if (!g.__auragate) {
    g.__auragate = {
      services: structuredClone(SEED_SERVICES),
      payments: [],
      receipts: [],
    };
  }
  return g.__auragate;
}

export function listServices(): Service[] {
  return db().services.filter((s) => s.active);
}

export function getService(slug: string): Service | undefined {
  return db().services.find((s) => s.slug === slug);
}

export function addService(
  input: Omit<Service, "createdAt" | "active" | "sampleResponse"> & {
    sampleResponse?: unknown;
  }
): Service {
  const svc: Service = {
    ...input,
    sampleResponse: input.sampleResponse ?? { ok: true },
    active: true,
    createdAt: new Date().toISOString(),
  };
  db().services.unshift(svc);
  return svc;
}

export function recordPayment(p: Omit<Payment, "id" | "createdAt">): Payment {
  const payment: Payment = {
    ...p,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  db().payments.unshift(payment);
  return payment;
}

export function listPayments(sellerAddress?: string): Payment[] {
  const all = db().payments;
  if (!sellerAddress) return all;
  const slugs = new Set(
    db()
      .services.filter(
        (s) => s.sellerAddress.toLowerCase() === sellerAddress.toLowerCase()
      )
      .map((s) => s.slug)
  );
  return all.filter((p) => slugs.has(p.serviceSlug));
}

export function recordReceipt(r: Omit<Receipt, "id" | "createdAt">): Receipt {
  const receipt: Receipt = {
    ...r,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  db().receipts.unshift(receipt);
  return receipt;
}

export function listReceipts(): Receipt[] {
  return db().receipts;
}

export function rateReceipt(id: string, rating: number): Receipt | undefined {
  const receipt = db().receipts.find((r) => r.id === id);
  if (receipt) receipt.rating = Math.max(1, Math.min(5, Math.round(rating)));
  return receipt;
}