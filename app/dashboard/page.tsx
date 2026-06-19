"use client";

import { useEffect, useState } from "react";
import type { Receipt, Service } from "@/lib/types";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { Stat } from "@/components/ui";
import { useWallet } from "@/components/wallet-provider";

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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (USDC)" value={usd(revenue)} />
        <Stat label="Requests paid" value={receipts.length} />
        <Stat label="Unique buyers" value={buyers} />
        <Stat label="Live services" value={services.length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Payments table */}
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
                {receipts.slice(0, 12).map((r) => (
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
      <div className="mt-4 space-y-3">
        <input
          className="input"
          placeholder="Service name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <textarea
          className="input min-h-20"
          placeholder="What does it do?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
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
        <button
          className="btn-primary w-full"
          onClick={submit}
          disabled={busy || !form.name}
        >
          {busy ? "Listing…" : "List service"}
        </button>
        {msg && <p className="text-center text-xs text-muted">{msg}</p>}
      </div>
    </div>
  );
}