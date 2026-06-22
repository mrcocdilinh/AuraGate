"use client";

import { useEffect, useMemo, useState } from "react";
import type { Receipt } from "@/lib/types";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { ARC } from "@/lib/arc";
import { Stars } from "@/components/ui";
import { loadSessionCreds } from "@/lib/wallet-client";

const ZERO = "0x0000000000000000000000000000000000000000";

function exportCsv(receipts: Receipt[]) {
  const head = ["id", "service", "payer", "amount", "mode", "requestHash", "resultHash", "settlementRef", "rating", "onchainTx", "createdAt"];
  const rows = receipts.map((r) =>
    [r.id, r.serviceSlug, r.payer, r.amount, r.mode ?? "", r.requestHash ?? "", r.resultHash, r.settlementRef ?? "", r.rating ?? "", r.onchainTx ?? "", r.createdAt]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auragate-receipts-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Seller rating summary ─────────────────────────────────────────────────────

function SellerRatings({ receipts }: { receipts: Receipt[] }) {
  const map: Record<string, { slug: string; total: number; count: number; ratingSum: number; ratingCount: number }> = {};
  for (const r of receipts) {
    if (!map[r.serviceSlug]) {
      map[r.serviceSlug] = { slug: r.serviceSlug, total: 0, count: 0, ratingSum: 0, ratingCount: 0 };
    }
    map[r.serviceSlug].total += Number(r.amount);
    map[r.serviceSlug].count += 1;
    if (r.rating) {
      map[r.serviceSlug].ratingSum += r.rating;
      map[r.serviceSlug].ratingCount += 1;
    }
  }
  const rows = Object.values(map).sort((a, b) => b.total - a.total);
  if (rows.length === 0) return null;

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="p-4">
        <h2 className="font-semibold">Avg rating per service</h2>
        <p className="mt-0.5 text-xs text-muted">Only rated receipts count toward the average.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr className="border-y border-line">
              <th className="px-4 py-2.5">Service</th>
              <th className="px-4 py-2.5">Revenue</th>
              <th className="px-4 py-2.5">Calls</th>
              <th className="px-4 py-2.5">Avg rating</th>
              <th className="px-4 py-2.5">Rated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const avg = row.ratingCount > 0 ? row.ratingSum / row.ratingCount : null;
              return (
                <tr key={row.slug} className="border-b border-line/60">
                  <td className="px-4 py-2.5 font-medium">{row.slug}</td>
                  <td className="px-4 py-2.5 text-mint">{usd(row.total)}</td>
                  <td className="px-4 py-2.5 text-muted">{row.count}</td>
                  <td className="px-4 py-2.5">
                    {avg !== null ? (
                      <span className="flex items-center gap-1.5">
                        <Stars value={avg} />
                        <span className="text-xs text-muted">{avg.toFixed(1)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">no ratings</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {row.ratingCount}/{row.count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZES = [50, 100, 200];

type AgentNetwork = {
  name?: string;
  caip2?: string;
  explorer?: string;
  receiptRegistry?: string;
  receiptRegistryVersion?: string;
};

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [network, setNetwork] = useState<AgentNetwork | null>(null);
  const [filterService, setFilterService] = useState("");
  const [filterPayer, setFilterPayer] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  async function load() {
    const r = await fetch("/api/receipts").then((x) => x.json());
    setReceipts(r.receipts ?? []);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/agent", { cache: "no-store" })
      .then((r) => r.json())
      .then((manifest) => setNetwork(manifest.network ?? null))
      .catch(() => setNetwork(null));
  }, []);

  async function rate(id: string, rating: number) {
    const creds = loadSessionCreds();
    await fetch("/api/receipts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, rating, userToken: creds?.userToken }),
    });
    load();
  }

  const serviceOptions = useMemo(
    () => Array.from(new Set(receipts.map((r) => r.serviceSlug))).sort(),
    [receipts]
  );
  const payerOptions = useMemo(
    () => Array.from(new Set(receipts.map((r) => r.payer))).sort(),
    [receipts]
  );

  const filtered = useMemo(
    () =>
      receipts.filter(
        (r) =>
          (!filterService || r.serviceSlug === filterService) &&
          (!filterPayer || r.payer === filterPayer)
      ),
    [receipts, filterService, filterPayer]
  );

  // Reset to the first page whenever the filters or page size change.
  useEffect(() => {
    setPage(0);
  }, [filterService, filterPayer, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = useMemo(
    () => filtered.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [filtered, safePage, pageSize]
  );
  const rangeStart = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min(filtered.length, safePage * pageSize + pageSize);
  const explorer = network?.explorer ?? ARC.explorer;
  const registry = network?.receiptRegistry ?? ARC.receiptRegistry;
  const registryVersion = network?.receiptRegistryVersion ?? ARC.receiptRegistryVersion;
  const chainName = network?.name ?? "Arc Testnet";
  const caip2 = network?.caip2 ?? ARC.caip2;
  const explorerTx = (hash: string) => `${explorer}/tx/${hash}`;
  const explorerAddress = (address: string) => `${explorer}/address/${address}`;

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Receipt explorer</h1>
          <p className="mt-1 text-sm text-muted">
            Every paid request is a verifiable receipt — payer, amount and a hash
            of the result. Rate a service to build seller reputation.
          </p>
        </div>
        <button
          className="btn-ghost text-xs"
          onClick={() => exportCsv(receipts)}
          disabled={receipts.length === 0}
        >
          Export CSV
        </button>
      </div>

      {/* On-chain registry status */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/50 px-4 py-2.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-mint" />
        <span className="text-muted">ReceiptRegistry on {chainName}:</span>
        {registry && registry !== ZERO ? (
          <a
            href={explorerAddress(registry)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-primary hover:underline"
          >
            {registry}
          </a>
        ) : (
          <span className="font-mono text-amber">
            not deployed yet — receipts are stored off-chain until the contract is live
          </span>
        )}
        {registry && registry !== ZERO && registryVersion === "2" ? (
          <span className="rounded-full border border-mint/30 px-2 py-0.5 font-mono text-[10px] uppercase text-mint">
            v2
          </span>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-3">
        <select
          className="input w-auto min-w-[160px]"
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
        >
          <option value="">All services</option>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="input w-auto min-w-[180px]"
          value={filterPayer}
          onChange={(e) => setFilterPayer(e.target.value)}
        >
          <option value="">All payers</option>
          {payerOptions.map((p) => (
            <option key={p} value={p}>{shortAddr(p)}</option>
          ))}
        </select>
        {(filterService || filterPayer) && (
          <button
            className="btn-ghost text-xs"
            onClick={() => { setFilterService(""); setFilterPayer(""); }}
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 self-center">
          <span className="text-xs text-muted">Per page</span>
          <select
            className="input w-auto !py-1.5 text-xs"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Receipt table */}
      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Payer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Result hash</th>
                <th className="px-4 py-3">Proof</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Rate</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-middle">
                  <td className="px-4 py-3 font-medium">{r.serviceSlug}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {shortAddr(r.payer)}
                  </td>
                  <td className="px-4 py-3 text-mint">{usd(r.amount)}</td>
                  <td className="px-4 py-3">
                    {r.onchainTx ? (
                      <a
                        href={explorerTx(r.onchainTx)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.resultHash.slice(0, 10)}…
                      </a>
                    ) : (
                      <span
                        className="font-mono text-xs text-muted"
                        title={r.resultHash}
                      >
                        {r.resultHash.slice(0, 10)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <a
                      href={`/api/receipts/${r.id}/verify`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                      title="Open the verifiable, signed payment proof"
                    >
                      verify
                    </a>
                    <span className="mx-1 text-line">·</span>
                    <a
                      href={`/api/receipts/${r.id}/verify?download=1`}
                      className="text-muted hover:text-ink"
                      title="Download proof JSON"
                    >
                      ⤓
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {timeAgo(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {r.rating ? (
                      <Stars value={r.rating} />
                    ) : (
                      <div className="flex gap-1 text-muted">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            className="hover:text-amber"
                            onClick={() => rate(r.id, n)}
                            title={`Rate ${n}`}
                          >
                            ☆
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    {receipts.length === 0
                      ? "No receipts yet. Buy a service to create the first one."
                      : "No receipts match the current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted">
            Showing {rangeStart}–{rangeEnd} of {filtered.length} receipts
            {receipts.length !== filtered.length && ` (filtered from ${receipts.length})`}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost text-xs disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              ← Prev
            </button>
            <span className="text-xs text-muted">
              Page {safePage + 1} of {pageCount}
            </span>
            <button
              className="btn-ghost text-xs disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Per-seller ratings summary */}
      <SellerRatings receipts={receipts} />

      <p className="mt-4 text-xs text-muted">
        On-chain receipts settle to the ReceiptRegistry on {chainName} (
        <span className="font-mono">{caip2}</span>).
      </p>
    </div>
  );
}
