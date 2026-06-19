"use client";

import { useEffect, useState } from "react";
import type { Receipt, Service } from "@/lib/types";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { Stat } from "@/components/ui";
import { useWallet } from "@/components/wallet-provider";

// ── Revenue bar chart (pure SVG, no external deps) ───────────────────────────

function RevenueChart({ receipts, services }: { receipts: Receipt[]; services: Service[] }) {
  const slugs = services.map((s) => s.slug);
  const bySlug: Record<string, number> = {};
  for (const s of slugs) bySlug[s] = 0;
  for (const r of receipts) {
    if (bySlug[r.serviceSlug] !== undefined) bySlug[r.serviceSlug] += Number(r.amount);
  }

  const max = Math.max(...Object.values(bySlug), 0.001);
  const W = 480;
  const H = 120;
  const PAD = { left: 48, right: 8, top: 8, bottom: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.floor(chartW / slugs.length) - 8;
  const gap = (chartW - barW * slugs.length) / (slugs.length + 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ fontFamily: "inherit" }}
    >
      {/* y-axis label */}
      <text x={PAD.left - 4} y={PAD.top} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted opacity-60">
        {usd(max)}
      </text>
      <text x={PAD.left - 4} y={PAD.top + chartH} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted opacity-60">
        $0
      </text>

      {/* gridline */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left + chartW} y2={PAD.top} stroke="currentColor" strokeOpacity={0.08} />
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="currentColor" strokeOpacity={0.15} />

      {slugs.map((slug, i) => {
        const val = bySlug[slug] ?? 0;
        const barH = Math.max((val / max) * chartH, val > 0 ? 4 : 0);
        const x = PAD.left + gap + i * (barW + gap);
        const y = PAD.top + chartH - barH;
        const label = services.find((s) => s.slug === slug)?.sellerName ?? slug;

        return (
          <g key={slug}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              className="fill-primary"
              fillOpacity={0.85}
            />
            {/* value label above bar */}
            {val > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="currentColor" className="fill-mint opacity-90">
                {usd(val)}
              </text>
            )}
            {/* x-axis label */}
            <text
              x={x + barW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize={8}
              fill="currentColor"
              className="opacity-50"
            >
              {label.length > 10 ? label.slice(0, 9) + "…" : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Top buyers table ──────────────────────────────────────────────────────────

function TopBuyers({ receipts }: { receipts: Receipt[] }) {
  const map: Record<string, { spent: number; calls: number }> = {};
  for (const r of receipts) {
    if (!map[r.payer]) map[r.payer] = { spent: 0, calls: 0 };
    map[r.payer].spent += Number(r.amount);
    map[r.payer].calls += 1;
  }
  const rows = Object.entries(map)
    .map(([payer, v]) => ({ payer, ...v }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 8);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <h2 className="font-semibold">Top buyers</h2>
        <span className="text-xs text-muted">{rows.length} unique</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr className="border-y border-line">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Address</th>
              <th className="px-4 py-2">Calls</th>
              <th className="px-4 py-2">Spent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.payer} className="border-b border-line/60">
                <td className="px-4 py-2 text-muted">{i + 1}</td>
                <td className="px-4 py-2 font-mono text-xs">{shortAddr(row.payer)}</td>
                <td className="px-4 py-2 text-muted">{row.calls}</td>
                <td className="px-4 py-2 font-semibold text-mint">{usd(row.spent)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted text-xs">
                  No buyers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const w = useWallet();
  const [services, setServices] = useState<Service[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  async function load() {
    const [s, r] = await Promise.all([
      fetch("/api/services").then((x) => x.json()),
      fetch("/api/receipts").then((x) => x.json()),
    ]);
    setServices(s.services ?? []);
    setReceipts(r.receipts ?? []);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const revenue = receipts.reduce((a, r) => a + Number(r.amount), 0);
  const buyers = new Set(receipts.map((r) => r.payer)).size;

  return (
    <div className="container-page py-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {w.status === "connected"
              ? `Signed in as ${shortAddr(w.address)}`
              : "Connect a wallet to receive USDC"}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (USDC)" value={usd(revenue)} />
        <Stat label="Requests paid" value={receipts.length} />
        <Stat label="Unique buyers" value={buyers} />
        <Stat label="Live services" value={services.length} />
      </div>

      {/* Revenue chart */}
      <div className="card mt-6 p-4">
        <h2 className="mb-3 font-semibold">Revenue by service</h2>
        <RevenueChart receipts={receipts} services={services} />
      </div>

      {/* Payments + top buyers */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent payments table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold">Recent payments</h2>
            <span className="badge">live · 5s</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr className="border-y border-line">
                  <th className="px-4 py-2.5">Service</th>
                  <th className="px-4 py-2.5">Buyer</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody>
                {receipts.slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="px-4 py-2.5 font-medium">{r.serviceSlug}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">
                      {shortAddr(r.payer)}
                    </td>
                    <td className="px-4 py-2.5 text-mint">{usd(r.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {timeAgo(r.createdAt)}
                    </td>
                  </tr>
                ))}
                {receipts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      No payments yet — run the agent or try a service.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <TopBuyers receipts={receipts} />
      </div>

      {/* Register service */}
      <div className="mt-6">
        <RegisterService address={w.address} onCreated={load} />
      </div>
    </div>
  );
}

function RegisterService({
  address,
  onCreated,
}: {
  address?: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "0.01",
    category: "data",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        sellerAddress: address ?? "0x0000000000000000000000000000000000000000",
        sellerName: "You",
      }),
    });
    if (res.ok) {
      setMsg("Service listed ✓");
      setForm({ name: "", description: "", price: "0.01", category: "data" });
      onCreated();
    } else {
      const e = await res.json().catch(() => ({}));
      setMsg(e.error ?? "Failed");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold">List a service</h2>
      <p className="mt-1 text-xs text-muted">
        Register an API and start accepting USDC per request.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          className="input"
          placeholder="Service name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="flex gap-3">
          <input
            className="input"
            placeholder="Price USDC"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {["data", "ai", "oracle", "compute", "market-insight"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="input min-h-20 sm:col-span-2"
          placeholder="What does it do?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button
          className="btn-primary sm:col-span-2"
          onClick={submit}
          disabled={busy || !form.name}
        >
          {busy ? "Listing…" : "List service"}
        </button>
        {msg && <p className="text-center text-xs text-muted sm:col-span-2">{msg}</p>}
      </div>
    </div>
  );
}
