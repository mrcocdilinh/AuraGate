"use client";

import { useEffect, useMemo, useState } from "react";
import type { Receipt } from "@/lib/types";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { ARC, explorerTx, explorerAddress } from "@/lib/arc";
import { Stars } from "@/components/ui";

const ZERO = "0x0000000000000000000000000000000000000000";

function exportCsv(receipts: Receipt[]) {
  const head = ["id", "service", "payer", "amount", "resultHash", "rating", "onchainTx", "createdAt"];
  const rows = receipts.map((r) =>
    [r.id, r.serviceSlug, r.payer, r.amount, r.resultHash, r.rating ?? "", r.onchainTx ?? "", r.createdAt]
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

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filterService, setFilterService] = useState("");
  const [filterPayer, setFilterPayer] = useState("");

  async function load() {
    const r = await fetch("/api/receipts").then((x) => x.json());
    setReceipts(r.receipts ?? []);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function rate(id: string, rating: number) {
    await fetch("/api/receipts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, rating }),
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
        <span className="text-muted">ReceiptRegistry on Arc Testnet:</span>
        {ARC.receiptRegistry && ARC.receiptRegistry !== ZERO ? (
          <a
            href={explorerAddress(ARC.receiptRegistry)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-primary hover:underline"
          >
            {ARC.receiptRegistry}
          </a>
        ) : (
          <span className="font-mono text-amber">
            not deployed yet — receipts are stored off-chain until the contract is live
          </span>
        )}
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
        <span className="ml-auto self-center text-xs text-muted">
          {filtered.length} of {receipts.length} receipts
        </span>
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
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Rate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
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
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
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

      {/* Per-seller ratings summary */}
      <SellerRatings receipts={receipts} />

      <p className="mt-4 text-xs text-muted">
        On-chain receipts settle to the ReceiptRegistry on Arc Testnet (
        <span className="font-mono">{ARC.caip2}</span>).
      </p>
    </div>
  );
}
