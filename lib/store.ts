import { randomUUID } from "crypto";
import type { Payment, Receipt, Service, SellerStats } from "./types";
import { SEED_SERVICES } from "./services-seed";
import { SEED_RECEIPTS } from "./receipts-seed";
import { db } from "./supabase";
import { isTrustedReceipt } from "./trust";

/** Build seed receipts with stable ids + staggered timestamps (newest first). */
function seedReceiptRows(): Receipt[] {
  const base = Date.now();
  return SEED_RECEIPTS.map((r, i) => ({
    ...r,
    id: `seed-receipt-${i + 1}`,
    createdAt: new Date(base - i * 47 * 60_000).toISOString(),
  }));
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToService(r: any): Service {
  return {
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: r.category,
    sellerAddress: r.seller_address,
    sellerName: r.seller_name,
    price: r.price,
    method: r.method,
    endpoint: r.endpoint,
    externalUrl: r.external_url ?? undefined,
    docsUrl: r.docs_url ?? undefined,
    tags: r.tags ?? undefined,
    sampleResponse: r.sample_response,
    verified: r.verified ?? false,
    active: r.active,
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPayment(r: any): Payment {
  return {
    id: r.id,
    serviceSlug: r.service_slug,
    buyerAddress: r.buyer_address,
    sellerAddress: r.seller_address ?? undefined,
    amount: r.amount,
    status: r.status,
    txHash: r.tx_hash ?? undefined,
    network: r.network,
    asset: r.asset ?? undefined,
    mode: r.mode ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToReceipt(r: any): Receipt {
  return {
    id: r.id,
    paymentId: r.payment_id,
    serviceSlug: r.service_slug,
    payer: r.payer,
    sellerAddress: r.seller_address ?? undefined,
    amount: r.amount,
    resultHash: r.result_hash,
    requestHash: r.request_hash ?? undefined,
    rating: r.rating ?? undefined,
    onchainTx: r.onchain_tx ?? undefined,
    blockNumber: r.block_number ?? undefined,
    mode: r.mode ?? undefined,
    settlementRef: r.settlement_ref ?? undefined,
    contractAddress: r.contract_address ?? undefined,
    createdAt: r.created_at,
  };
}

// ─── In-memory fallback ──────────────────────────────────────────────────────

interface DB {
  services: Service[];
  payments: Payment[];
  receipts: Receipt[];
}
const g = globalThis as unknown as { __ag?: DB };
const RECEIPT_DEFAULT_LIMIT = 200;
const RECEIPT_PAGE_SIZE = 1000;
const RETIRED_SERVICE_SLUGS = new Set(["market-insight"]);

function isRetiredService(slug: string): boolean {
  return RETIRED_SERVICE_SLUGS.has(slug);
}

function mem(): DB {
  if (!g.__ag)
    g.__ag = {
      services: structuredClone(SEED_SERVICES),
      payments: [],
      receipts: seedReceiptRows(),
    };
  return g.__ag;
}

// ─── Services ────────────────────────────────────────────────────────────────

async function getAllServices(): Promise<Service[]> {
  if (db) {
    const { data, error } = await db.from("services").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) {
      await seedSupabase();
      const { data: seeded } = await db.from("services").select("*").order("created_at", { ascending: false });
      return (seeded ?? [])
        .filter((r) => !isRetiredService(r.slug))
        .map(rowToService);
    }
    return data.filter((r) => !isRetiredService(r.slug)).map(rowToService);
  }
  return mem().services.filter((s) => !isRetiredService(s.slug));
}

async function seedSupabase(): Promise<void> {
  if (!db) return;
  const rows = SEED_SERVICES.map((s) => ({
    slug: s.slug,
    name: s.name,
    description: s.description,
    category: s.category,
    seller_address: s.sellerAddress,
    seller_name: s.sellerName,
    price: s.price,
    method: s.method,
    endpoint: s.endpoint,
    external_url: s.externalUrl ?? null,
    docs_url: s.docsUrl ?? null,
    tags: s.tags ?? null,
    sample_response: s.sampleResponse,
    verified: s.verified ?? false,
    active: s.active,
    created_at: s.createdAt,
  }));
  await db.from("services").upsert(rows, { onConflict: "slug" });
}

/** Seed demo receipts into Supabase once (only when the table is empty). */
async function seedReceiptsSupabase(): Promise<void> {
  if (!db) return;
  const rows = seedReceiptRows().map((r) => ({
    id: randomUUID(),
    payment_id: r.paymentId,
    service_slug: r.serviceSlug,
    payer: r.payer,
    amount: r.amount,
    result_hash: r.resultHash,
    request_hash: null,
    rating: r.rating ?? null,
    onchain_tx: null,
    block_number: null,
    mode: "mock",
    settlement_ref: null,
    contract_address: null,
    created_at: r.createdAt,
  }));
  await db.from("receipts").insert(rows);
}

export async function listServices(): Promise<Service[]> {
  if (db) {
    const { data: all, error } = await db.from("services").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    // Re-seed (upsert) whenever DB has fewer slugs than the current seed file.
    if (!all || all.length < SEED_SERVICES.length) {
      await seedSupabase();
      const { data: seeded } = await db.from("services").select("*").eq("active", true).order("created_at", { ascending: false });
      return (seeded ?? [])
        .filter((r) => r.active && !isRetiredService(r.slug))
        .map(rowToService);
    }
    return all
      .filter((r) => r.active && !isRetiredService(r.slug))
      .map(rowToService);
  }
  return mem().services.filter((s) => s.active && !isRetiredService(s.slug));
}

export async function getService(slug: string): Promise<Service | undefined> {
  if (isRetiredService(slug)) return undefined;
  if (db) {
    const { data } = await db.from("services").select("*").eq("slug", slug).single();
    return data ? rowToService(data) : undefined;
  }
  return mem().services.find((s) => s.slug === slug);
}

export async function addService(
  input: Omit<Service, "createdAt" | "active" | "sampleResponse"> & { sampleResponse?: unknown }
): Promise<Service> {
  const now = new Date().toISOString();
  if (db) {
    const row = {
      slug: input.slug,
      name: input.name,
      description: input.description,
      category: input.category,
      seller_address: input.sellerAddress,
      seller_name: input.sellerName,
      price: input.price,
      method: input.method,
      endpoint: input.endpoint,
      external_url: input.externalUrl ?? null,
      docs_url: input.docsUrl ?? null,
      tags: input.tags ?? null,
      sample_response: input.sampleResponse ?? { ok: true },
      verified: input.verified ?? false,
      active: true,
      created_at: now,
    };
    const { data, error } = await db.from("services").insert(row).select().single();
    if (error) throw error;
    return rowToService(data);
  }
  const svc: Service = { ...input, sampleResponse: input.sampleResponse ?? { ok: true }, active: true, createdAt: now };
  mem().services.unshift(svc);
  return svc;
}

export async function setServiceActive(slug: string, active: boolean): Promise<Service | undefined> {
  if (db) {
    const { data, error } = await db.from("services").update({ active }).eq("slug", slug).select().single();
    if (error || !data) return undefined;
    return rowToService(data);
  }
  const svc = mem().services.find((s) => s.slug === slug);
  if (!svc) return undefined;
  svc.active = active;
  return svc;
}

export async function deleteService(slug: string): Promise<boolean> {
  if (db) {
    const { error, count } = await db.from("services").delete({ count: "exact" }).eq("slug", slug);
    if (error) return false;
    return (count ?? 0) > 0;
  }
  const before = mem().services.length;
  mem().services = mem().services.filter((s) => s.slug !== slug);
  return mem().services.length < before;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function recordPayment(p: Omit<Payment, "id" | "createdAt">): Promise<Payment> {
  const now = new Date().toISOString();
  if (db) {
    const row = {
      id: randomUUID(),
      service_slug: p.serviceSlug,
      buyer_address: p.buyerAddress,
      seller_address: p.sellerAddress ?? null,
      amount: p.amount,
      status: p.status,
      tx_hash: p.txHash ?? null,
      network: p.network,
      asset: p.asset ?? null,
      mode: p.mode ?? "testnet",
      verified_at: p.verifiedAt ?? null,
      created_at: now,
    };
    const { data, error } = await db.from("payments").insert(row).select().single();
    if (error) throw error;
    return rowToPayment(data);
  }
  const payment: Payment = { ...p, id: randomUUID(), createdAt: now };
  mem().payments.unshift(payment);
  return payment;
}

export async function listPayments(): Promise<Payment[]> {
  if (db) {
    const { data, error } = await db.from("payments").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map(rowToPayment);
  }
  return mem().payments;
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export async function recordReceipt(r: Omit<Receipt, "id" | "createdAt">): Promise<Receipt> {
  const now = new Date().toISOString();
  if (db) {
    const row = {
      id: randomUUID(),
      payment_id: r.paymentId,
      service_slug: r.serviceSlug,
      payer: r.payer,
      seller_address: r.sellerAddress ?? null,
      amount: r.amount,
      result_hash: r.resultHash,
      request_hash: r.requestHash ?? null,
      rating: r.rating ?? null,
      onchain_tx: r.onchainTx ?? null,
      block_number: r.blockNumber ?? null,
      mode: r.mode ?? "testnet",
      settlement_ref: r.settlementRef ?? null,
      contract_address: r.contractAddress ?? null,
      created_at: now,
    };
    const { data, error } = await db.from("receipts").insert(row).select().single();
    if (error) throw error;
    return rowToReceipt(data);
  }
  const receipt: Receipt = { ...r, id: randomUUID(), createdAt: now };
  mem().receipts.unshift(receipt);
  return receipt;
}

export async function listReceipts(limit = RECEIPT_DEFAULT_LIMIT): Promise<Receipt[]> {
  if (db) {
    const { data, error } = await db
      .from("receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (!data || data.length === 0) {
      await seedReceiptsSupabase();
      const { data: seeded } = await db
        .from("receipts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (seeded ?? []).map(rowToReceipt);
    }
    return data.map(rowToReceipt);
  }
  return mem().receipts.slice(0, limit);
}

export async function listAllReceipts(): Promise<Receipt[]> {
  if (!db) return mem().receipts;

  const rows: unknown[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from("receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + RECEIPT_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < RECEIPT_PAGE_SIZE) break;
    offset += RECEIPT_PAGE_SIZE;
  }

  if (rows.length === 0) {
    await seedReceiptsSupabase();
    return listReceipts(RECEIPT_PAGE_SIZE);
  }

  return rows.map(rowToReceipt);
}

export async function getReceipt(id: string): Promise<Receipt | undefined> {
  if (db) {
    const { data, error } = await db.from("receipts").select("*").eq("id", id).single();
    if (error || !data) return undefined;
    return rowToReceipt(data);
  }
  return mem().receipts.find((r) => r.id === id);
}

export async function updateReceiptOnchainTx(id: string, onchainTx: string): Promise<void> {
  if (db) {
    await db.from("receipts").update({ onchain_tx: onchainTx }).eq("id", id);
    return;
  }
  const r = mem().receipts.find((r) => r.id === id);
  if (r) r.onchainTx = onchainTx;
}

export async function rateReceipt(id: string, rating: number): Promise<Receipt | undefined> {
  const stars = Math.max(1, Math.min(5, Math.round(rating)));
  if (db) {
    const { data, error } = await db.from("receipts").update({ rating: stars }).eq("id", id).select().single();
    if (error || !data) return undefined;
    return rowToReceipt(data);
  }
  const receipt = mem().receipts.find((r) => r.id === id);
  if (receipt) receipt.rating = stars;
  return receipt;
}

// ─── Reputation ──────────────────────────────────────────────────────────────

export async function getSellers(): Promise<SellerStats[]> {
  const [services, receipts] = await Promise.all([getAllServices(), listAllReceipts()]);
  const trustedReceipts = receipts.filter(isTrustedReceipt);

  const slugToSeller = new Map<string, { address: string; name: string }>();
  for (const s of services) slugToSeller.set(s.slug, { address: s.sellerAddress, name: s.sellerName });

  type Acc = Omit<SellerStats, "reputation"> & { ratingSum: number };
  const map = new Map<string, Acc>();

  const ensure = (address: string, name: string, createdAt: string): Acc => {
    let a = map.get(address);
    if (!a) {
      a = { address, name, services: 0, calls: 0, revenue: 0, avgRating: null, ratedCount: 0, verifiedServices: 0, firstSeen: createdAt, ratingSum: 0 };
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

  for (const r of trustedReceipts) {
    const owner = slugToSeller.get(r.serviceSlug);
    if (!owner) continue;
    const a = ensure(owner.address, owner.name, r.createdAt);
    a.calls += 1;
    a.revenue += Number(r.amount);
    if (r.rating) { a.ratingSum += r.rating; a.ratedCount += 1; }
  }

  return [...map.values()]
    .map((a) => {
      const avgRating = a.ratedCount > 0 ? a.ratingSum / a.ratedCount : null;
      const ratingScore = avgRating !== null ? (avgRating / 5) * 50 : 20;
      const demandScore = Math.min(a.calls / 50, 1) * 30;
      const verifiedScore = a.services > 0 ? (a.verifiedServices / a.services) * 20 : 0;
      const reputation = Math.round(ratingScore + demandScore + verifiedScore);
      return { address: a.address, name: a.name, services: a.services, calls: a.calls, revenue: a.revenue, avgRating, ratedCount: a.ratedCount, verifiedServices: a.verifiedServices, reputation, firstSeen: a.firstSeen } satisfies SellerStats;
    })
    .sort((a, b) => b.reputation - a.reputation || b.revenue - a.revenue);
}
