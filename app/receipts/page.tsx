"use client";

import { useEffect, useMemo, useState } from "react";
import type { Receipt } from "@/lib/types";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { ARC } from "@/lib/arc";
import { loadSessionCreds } from "@/lib/wallet-client";

const ZERO = "0x0000000000000000000000000000000000000000";

// ── Helpers ───────────────────────────────────────────────────────────────────

function exportCsv(receipts: Receipt[]) {
  const head = ["id","service","payer","amount","mode","requestHash","resultHash","settlementRef","rating","onchainTx","createdAt"];
  const rows = receipts.map((r) =>
    [r.id,r.serviceSlug,r.payer,r.amount,r.mode??"",r.requestHash??"",r.resultHash,r.settlementRef??"",r.rating??"",r.onchainTx??"",r.createdAt]
      .map((v) => `"${String(v).replace(/"/g,'""')}"`)
      .join(",")
  );
  const blob = new Blob([[head.join(","),...rows].join("\n")],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `auragate-receipts-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// Deterministic color per service slug
const SERVICE_COLORS: Record<string, string> = {};
const PALETTE = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-mint/10 text-mint border-mint/20",
  "bg-purple/10 text-purple border-purple/20",
  "bg-amber/10 text-amber border-amber/20",
  "bg-cyan/10 text-cyan border-cyan/20",
  "bg-danger/10 text-danger border-danger/20",
];
function serviceColor(slug: string) {
  if (!SERVICE_COLORS[slug]) {
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
    SERVICE_COLORS[slug] = PALETTE[h % PALETTE.length];
  }
  return SERVICE_COLORS[slug];
}

// Stable payer dot color
function payerDotColor(addr: string) {
  const colors = ["bg-primary","bg-mint","bg-purple","bg-amber","bg-cyan","bg-danger"];
  let h = 0;
  for (let i = 2; i < 8; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onRate }: { value?: number | null; onRate?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  if (value) {
    return (
      <span className="flex gap-0.5">
        {[1,2,3,4,5].map((n) => (
          <span key={n} className={`text-[13px] ${n <= value ? "text-amber" : "text-line"}`}>★</span>
        ))}
      </span>
    );
  }
  if (!onRate) return <span className="text-xs text-muted/40">—</span>;
  return (
    <span className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          className={`text-[13px] transition-colors ${n <= hover ? "text-amber" : "text-muted/30 hover:text-amber/60"}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onRate(n)}
          title={`Rate ${n}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-panel/60 px-4 py-3 min-w-[110px]">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="mt-0.5 text-lg font-bold text-ink">{value}</span>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 rounded px-1 py-0.5 text-[10px] text-muted hover:text-ink transition"
      title="Copy address"
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100];

type AgentNetwork = { name?: string; caip2?: string; explorer?: string; receiptRegistry?: string; receiptRegistryVersion?: string };

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [network, setNetwork] = useState<AgentNetwork | null>(null);
  const [filterService, setFilterService] = useState("");
  const [filterPayer, setFilterPayer] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  async function load() {
    const r = await fetch("/api/receipts").then((x) => x.json());
    setReceipts(r.receipts ?? []);
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  useEffect(() => {
    fetch("/api/agent",{cache:"no-store"}).then(r=>r.json()).then(m=>setNetwork(m.network??null)).catch(()=>setNetwork(null));
  }, []);

  async function rate(id: string, rating: number) {
    const creds = loadSessionCreds();
    await fetch("/api/receipts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,rating,userToken:creds?.userToken})});
    load();
  }

  const serviceOptions = useMemo(() => Array.from(new Set(receipts.map(r => r.serviceSlug))).sort(), [receipts]);
  const payerOptions   = useMemo(() => Array.from(new Set(receipts.map(r => r.payer))).sort(), [receipts]);

  const filtered = useMemo(() =>
    receipts.filter(r => (!filterService || r.serviceSlug === filterService) && (!filterPayer || r.payer === filterPayer)),
    [receipts, filterService, filterPayer]
  );

  useEffect(() => setPage(0), [filterService, filterPayer, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage  = Math.min(page, pageCount - 1);
  const paged     = useMemo(() => filtered.slice(safePage * pageSize, safePage * pageSize + pageSize), [filtered, safePage, pageSize]);

  const totalVolume  = useMemo(() => receipts.reduce((s, r) => s + Number(r.amount), 0), [receipts]);
  const uniquePayers = useMemo(() => new Set(receipts.map(r => r.payer)).size, [receipts]);
  const onchainCount = useMemo(() => receipts.filter(r => r.onchainTx).length, [receipts]);

  const explorer        = network?.explorer        ?? ARC.explorer;
  const registry        = network?.receiptRegistry ?? ARC.receiptRegistry;
  const registryVersion = network?.receiptRegistryVersion ?? ARC.receiptRegistryVersion;
  const chainName       = network?.name            ?? "Arc Testnet";
  const explorerTx   = (hash: string)    => `${explorer}/tx/${hash}`;
  const explorerAddr = (address: string) => `${explorer}/address/${address}`;

  return (
    <div className="container-page py-10 space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipt explorer</h1>
          <p className="mt-1 text-sm text-muted max-w-lg">
            Every paid request produces a verifiable receipt. Payer, amount, and a hash of the result are recorded onchain.
          </p>
        </div>
        <button
          className="btn-ghost gap-2 text-xs self-start"
          onClick={() => exportCsv(receipts)}
          disabled={receipts.length === 0}
        >
          <DownloadIcon /> Export CSV
        </button>
      </div>

      {/* Stat bar */}
      <div className="flex flex-wrap gap-3">
        <Stat label="Total receipts" value={receipts.length.toLocaleString()} />
        <Stat label="Total volume"   value={usd(totalVolume)} />
        <Stat label="Unique payers"  value={uniquePayers.toLocaleString()} />
        <Stat label="Onchain"        value={`${onchainCount} / ${receipts.length}`} />
      </div>

      {/* Registry bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/40 px-4 py-2.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-mint animate-pulse" />
          <span className="text-muted">ReceiptRegistry · {chainName}</span>
        </span>
        {registry && registry !== ZERO ? (
          <>
            <a href={explorerAddr(registry)} target="_blank" rel="noreferrer"
               className="font-mono text-primary hover:underline truncate max-w-[260px]">
              {registry}
            </a>
            <CopyBtn text={registry} />
            {registryVersion === "2" && (
              <span className="rounded-full border border-mint/30 bg-mint/5 px-2 py-0.5 font-mono text-[10px] uppercase text-mint">v2</span>
            )}
          </>
        ) : (
          <span className="text-amber/80">Not deployed — receipts stored off-chain</span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto min-w-[150px] !py-2 text-xs" value={filterService} onChange={e => setFilterService(e.target.value)}>
          <option value="">All services</option>
          {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto min-w-[170px] !py-2 text-xs" value={filterPayer} onChange={e => setFilterPayer(e.target.value)}>
          <option value="">All payers</option>
          {payerOptions.map(p => <option key={p} value={p}>{shortAddr(p)}</option>)}
        </select>
        {(filterService || filterPayer) && (
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => { setFilterService(""); setFilterPayer(""); }}>
            ✕ Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span>Per page</span>
          <select className="input w-auto !py-1.5 text-xs" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Payer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Result hash</th>
                <th className="px-4 py-3 font-medium">Proof</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {paged.map((r) => (
                <tr key={r.id} className="group hover:bg-panel/30 transition-colors align-middle">

                  {/* Service */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${serviceColor(r.serviceSlug)}`}>
                      {r.serviceSlug}
                    </span>
                  </td>

                  {/* Payer */}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${payerDotColor(r.payer)}`} />
                      <span className="font-mono text-xs text-muted">{shortAddr(r.payer)}</span>
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-mint">{usd(r.amount)}</span>
                  </td>

                  {/* Result hash + onchain indicator */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {r.onchainTx ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-mint" title="Settled onchain" />
                          <a href={explorerTx(r.onchainTx)} target="_blank" rel="noreferrer"
                             className="font-mono text-[11px] text-primary hover:underline">
                            {r.resultHash.slice(0, 10)}…
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-muted/40" title="Pending onchain" />
                          <span className="font-mono text-[11px] text-muted" title={r.resultHash}>
                            {r.resultHash.slice(0, 10)}…
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Proof */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a href={`/api/receipts/${r.id}/verify`} target="_blank" rel="noreferrer"
                         className="rounded-md border border-line/60 bg-panel2/40 px-2 py-0.5 text-[11px] text-primary transition hover:border-primary/40 hover:bg-primary/10">
                        verify
                      </a>
                      <a href={`/api/receipts/${r.id}/verify?download=1`}
                         className="text-muted hover:text-ink transition" title="Download proof JSON">
                        <DownloadIcon size={13} />
                      </a>
                    </div>
                  </td>

                  {/* When */}
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                    {timeAgo(r.createdAt)}
                  </td>

                  {/* Rate */}
                  <td className="px-4 py-3">
                    <StarRating value={r.rating} onRate={r.rating ? undefined : (n) => rate(r.id, n)} />
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <p className="text-muted">
                      {receipts.length === 0
                        ? "No receipts yet. Buy a service to generate the first one."
                        : "No receipts match the current filters."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {filtered.length === 0 ? "0 results" : `${safePage * pageSize + 1}–${Math.min(filtered.length, safePage * pageSize + pageSize)} of ${filtered.length}`}
            {receipts.length !== filtered.length && ` (${receipts.length} total)`}
          </span>
          <div className="flex items-center gap-1">
            <PaginationBtn onClick={() => setPage(0)} disabled={safePage === 0}>«</PaginationBtn>
            <PaginationBtn onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>‹ Prev</PaginationBtn>
            <span className="px-3 text-xs text-muted">Page {safePage + 1} / {pageCount}</span>
            <PaginationBtn onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}>Next ›</PaginationBtn>
            <PaginationBtn onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1}>»</PaginationBtn>
          </div>
        </div>
      )}

      {/* Service summary */}
      <ServiceSummary receipts={receipts} />
    </div>
  );
}

// ── Pagination button ─────────────────────────────────────────────────────────

function PaginationBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-line bg-panel/60 px-2.5 py-1.5 text-xs text-muted transition hover:border-primary/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// ── Service summary ───────────────────────────────────────────────────────────

function ServiceSummary({ receipts }: { receipts: Receipt[] }) {
  const rows = useMemo(() => {
    const map: Record<string, { slug: string; total: number; count: number; ratingSum: number; ratingCount: number }> = {};
    for (const r of receipts) {
      if (!map[r.serviceSlug]) map[r.serviceSlug] = { slug: r.serviceSlug, total: 0, count: 0, ratingSum: 0, ratingCount: 0 };
      map[r.serviceSlug].total += Number(r.amount);
      map[r.serviceSlug].count += 1;
      if (r.rating) { map[r.serviceSlug].ratingSum += r.rating; map[r.serviceSlug].ratingCount += 1; }
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [receipts]);

  if (rows.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Service summary</h2>
        <span className="text-xs text-muted">{rows.length} services</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line/60 text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-5 py-2.5 font-medium">Service</th>
              <th className="px-5 py-2.5 font-medium">Revenue</th>
              <th className="px-5 py-2.5 font-medium">Calls</th>
              <th className="px-5 py-2.5 font-medium">Avg rating</th>
              <th className="px-5 py-2.5 font-medium">Rated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/30">
            {rows.map((row) => {
              const avg = row.ratingCount > 0 ? row.ratingSum / row.ratingCount : null;
              return (
                <tr key={row.slug} className="hover:bg-panel/20 transition-colors">
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${serviceColor(row.slug)}`}>
                      {row.slug}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-mint">{usd(row.total)}</td>
                  <td className="px-5 py-3 text-muted">{row.count.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    {avg !== null ? (
                      <span className="flex items-center gap-1.5">
                        <StarRating value={Math.round(avg)} />
                        <span className="text-xs text-muted">{avg.toFixed(1)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted/50">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs text-muted">
                      {row.ratingCount}/{row.count}
                    </span>
                    {row.count > 0 && (
                      <span className="ml-2 text-[10px] text-muted/50">
                        ({Math.round(row.ratingCount / row.count * 100)}%)
                      </span>
                    )}
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

// ── Icons ─────────────────────────────────────────────────────────────────────

function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
