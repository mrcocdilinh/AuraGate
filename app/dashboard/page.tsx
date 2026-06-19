"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Receipt, Service } from "@/lib/types";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { Stat, VerifiedBadge } from "@/components/ui";
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
  const barW = Math.floor(chartW / Math.max(slugs.length, 1)) - 8;
  const gap = (chartW - barW * slugs.length) / (slugs.length + 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: "inherit" }}>
      <text x={PAD.left - 4} y={PAD.top} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted opacity-60">
        {usd(max)}
      </text>
      <text x={PAD.left - 4} y={PAD.top + chartH} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted opacity-60">
        $0
      </text>
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
            <rect x={x} y={y} width={barW} height={barH} rx={3} className="fill-primary" fillOpacity={0.85} />
            {val > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="currentColor" className="fill-mint opacity-90">
                {usd(val)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize={8} fill="currentColor" className="opacity-50">
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

  const myServices = useMemo(
    () => (w.address ? services.filter((s) => s.sellerAddress === w.address) : []),
    [services, w.address]
  );

  return (
    <div className="container-page py-10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {w.status === "connected"
              ? `Signed in as ${shortAddr(w.address)}`
              : "Connect a wallet to receive USDC and manage your listings"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (USDC)" value={usd(revenue)} />
        <Stat label="Requests paid" value={receipts.length} />
        <Stat label="Unique buyers" value={buyers} />
        <Stat label="Live services" value={services.length} />
      </div>

      <div className="card mt-6 p-4">
        <h2 className="mb-3 font-semibold">Revenue by service</h2>
        <RevenueChart receipts={receipts} services={services} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{shortAddr(r.payer)}</td>
                    <td className="px-4 py-2.5 text-mint">{usd(r.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{timeAgo(r.createdAt)}</td>
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

      {/* My services management */}
      <MyServices services={myServices} address={w.address} onChange={load} connected={w.status === "connected"} />

      {/* Register service */}
      <div className="mt-6">
        <RegisterService address={w.address} sellerName={w.email} onCreated={load} />
      </div>
    </div>
  );
}

// ── My services (manage/deactivate/delete) ──────────────────────────────────────

function MyServices({
  services,
  address,
  onChange,
  connected,
}: {
  services: Service[];
  address?: string;
  onChange: () => void;
  connected: boolean;
}) {
  const [busy, setBusy] = useState("");

  async function toggle(slug: string, active: boolean) {
    setBusy(slug);
    await fetch("/api/services", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, active, sellerAddress: address }),
    });
    await onChange();
    setBusy("");
  }

  async function remove(slug: string) {
    if (!confirm(`Delete "${slug}" from the registry? This cannot be undone.`)) return;
    setBusy(slug);
    await fetch("/api/services", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, sellerAddress: address }),
    });
    await onChange();
    setBusy("");
  }

  return (
    <div className="card mt-6 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <h2 className="font-semibold">My services</h2>
        <span className="text-xs text-muted">{services.length} listed under this wallet</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr className="border-y border-line">
              <th className="px-4 py-2.5">Service</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Endpoint</th>
              <th className="px-4 py-2.5 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.slug} className="border-b border-line/60">
                <td className="px-4 py-2.5">
                  <Link href={`/services/${s.slug}`} className="font-medium hover:text-primary">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-mint">{usd(s.price)}</td>
                <td className="px-4 py-2.5">
                  <VerifiedBadge verified={s.verified} hosted={s.externalUrl ? "seller" : "auragate"} />
                </td>
                <td className="px-4 py-2.5 max-w-[180px] truncate font-mono text-[11px] text-muted">
                  {s.endpoint}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      className="text-xs text-muted hover:text-ink disabled:opacity-40"
                      disabled={busy === s.slug}
                      onClick={() => toggle(s.slug, !s.active)}
                    >
                      {s.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="text-xs text-danger hover:underline disabled:opacity-40"
                      disabled={busy === s.slug}
                      onClick={() => remove(s.slug)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted">
                  {connected
                    ? "No services under this wallet yet — list one below."
                    : "Connect a wallet to see services you've listed."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Register a service ──────────────────────────────────────────────────────────

function RegisterService({
  address,
  sellerName,
  onCreated,
}: {
  address?: string;
  sellerName?: string;
  onCreated: () => void;
}) {
  const empty = {
    name: "",
    description: "",
    price: "0.01",
    category: "data",
    method: "GET",
    sellerName: "",
    externalUrl: "",
    docsUrl: "",
    tags: "",
    sampleResponse: "",
  };
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        sellerAddress: address ?? "0x0000000000000000000000000000000000000000",
        sellerName: form.sellerName || sellerName || "You",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const verified = data.service?.verified;
      setMsg({
        ok: true,
        text: form.externalUrl
          ? verified
            ? "Listed ✓ — endpoint returned a valid 402 challenge (verified)."
            : "Listed, but the endpoint didn't return a 402 — marked unverified."
          : "Service listed ✓",
      });
      setForm(empty);
      onCreated();
    } else {
      setMsg({ ok: false, text: data.error ?? "Failed to list service" });
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold">List a service</h2>
      <p className="mt-1 text-xs text-muted">
        Register any x402 endpoint — your own hosted URL, or leave it blank to get
        a hosted demo endpoint at <code className="text-ink">/api/premium/[slug]</code>.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="Service name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <input className="input" placeholder="Seller / brand name" value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} />

        <textarea className="input min-h-20 sm:col-span-2" placeholder="What does it do?" value={form.description} onChange={(e) => set("description", e.target.value)} />

        <div className="flex gap-3">
          <input className="input" placeholder="Price USDC" value={form.price} onChange={(e) => set("price", e.target.value)} />
          <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {["data", "ai", "oracle", "compute", "market-insight"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="input w-28" value={form.method} onChange={(e) => set("method", e.target.value)}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>
        <input className="input" placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => set("tags", e.target.value)} />

        <input className="input sm:col-span-2" placeholder="Your x402 endpoint URL (optional — https://…)" value={form.externalUrl} onChange={(e) => set("externalUrl", e.target.value)} />
        <input className="input sm:col-span-2" placeholder="Docs / homepage URL (optional)" value={form.docsUrl} onChange={(e) => set("docsUrl", e.target.value)} />

        <textarea
          className="input min-h-20 font-mono text-xs sm:col-span-2"
          placeholder='Sample response JSON (optional) — e.g. {"result": 42}'
          value={form.sampleResponse}
          onChange={(e) => set("sampleResponse", e.target.value)}
        />

        <button className="btn-primary sm:col-span-2" onClick={submit} disabled={busy || !form.name}>
          {busy ? "Listing…" : "List service"}
        </button>
        {msg && (
          <p className={`text-center text-xs sm:col-span-2 ${msg.ok ? "text-mint" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
