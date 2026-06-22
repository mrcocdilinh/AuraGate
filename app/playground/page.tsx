"use client";

import { useState } from "react";
import { useWallet } from "@/components/wallet-provider";
import { usd } from "@/lib/format";

interface LogLine {
  kind: "info" | "402" | "pay" | "data" | "done" | "error";
  text: string;
}

const MOCK_AGENT = "0xDemoAgent0000000000000000000000000000001";

export default function PlaygroundPage() {
  const w = useWallet();
  const [log, setLog] = useState<LogLine[]>([]);
  const [spent, setSpent] = useState(0);
  const [limit, setLimit] = useState("0.10");
  const [running, setRunning] = useState(false);

  const payerAddress = w.status === "connected" ? w.address : MOCK_AGENT;

  function push(line: LogLine) {
    setLog((l) => [...l, line]);
  }

  async function run() {
    setRunning(true);
    setLog([]);
    setSpent(0);
    const cap = Number(limit);
    let total = 0;

    push({ kind: "info", text: `Agent starting — payer: ${payerAddress?.slice(0, 10)}…` });
    push({ kind: "info", text: "Reading AuraGate catalog at /api/agent…" });

    let manifest: { services?: Array<{ id: string; name: string; url: string; method: string; price: { amount: string } }> };
    try {
      manifest = await fetch("/api/agent").then((r) => r.json());
    } catch {
      push({ kind: "error", text: "Failed to fetch catalog." });
      setRunning(false);
      return;
    }

    const services = manifest.services ?? [];
    push({ kind: "info", text: `Found ${services.length} services. Spending limit ${usd(cap)}.` });

    for (const s of services) {
      const price = Number(s.price.amount);
      if (total + price > cap) {
        push({ kind: "info", text: `Skipping ${s.name} — would exceed limit.` });
        continue;
      }

      const method = (s.method ?? "GET").toUpperCase();
      const isPost = method === "POST";
      const postBody = isPost ? JSON.stringify({ text: "AuraGate is a permissionless marketplace where AI agents pay USDC per request using the x402 protocol on Arc testnet." }) : undefined;
      const postHeaders = isPost ? { "content-type": "application/json" } : {};

      const r1 = await fetch(s.url, { method });
      push({ kind: "402", text: `${s.name}: ${r1.status} Payment Required (${usd(price)})` });

      const r2 = await fetch(s.url, {
        method,
        headers: {
          ...postHeaders,
          "x-payment": btoa(JSON.stringify({ amount: s.price.amount, payer: payerAddress })),
          "x-payer": payerAddress ?? "",
        },
        ...(isPost ? { body: postBody } : {}),
      });

      if (!r2.ok) {
        push({ kind: "error", text: `${s.name}: payment failed (${r2.status})` });
        continue;
      }

      const receiptId = r2.headers.get("x-receipt-id");
      total += price;
      setSpent(total);
      push({ kind: "pay", text: `Paid ${usd(price)} → receipt ${receiptId?.slice(0, 8)}…` });

      const data = await r2.json().catch(() => null);
      const preview = JSON.stringify(data).slice(0, 100);
      push({ kind: "data", text: `Data: ${preview}${preview.length >= 100 ? "…" : ""}` });
    }

    push({ kind: "done", text: `Done. Total spent ${usd(total)} across ${services.length} calls.` });
    setRunning(false);
  }

  const color: Record<LogLine["kind"], string> = {
    info: "text-muted",
    "402": "text-amber",
    pay: "text-primary",
    data: "text-mint",
    done: "text-ink font-semibold",
    error: "text-danger",
  };

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Agent playground</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Watch an autonomous agent discover services, pay USDC per request with a
        spending limit, and collect on-chain receipts — the full x402 loop, live.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div className="card h-fit p-5">
          <label className="text-xs uppercase tracking-wide text-muted">
            Spending limit (USDC)
          </label>
          <input
            className="input mt-2"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">Spent this run</span>
            <span className="font-bold text-mint">{usd(spent)}</span>
          </div>
          <div className="mt-3 rounded-lg border border-line bg-surface p-3 text-xs text-muted">
            <span className="text-ink">Payer:</span>{" "}
            <span className="font-mono">{payerAddress?.slice(0, 14)}…</span>
            {w.status !== "connected" && (
              <span className="ml-1 text-amber">(demo address)</span>
            )}
          </div>
          <button
            className="btn-primary mt-4 w-full"
            onClick={run}
            disabled={running}
          >
            {running ? "Agent working…" : "Run agent"}
          </button>
          {w.status !== "connected" && (
            <p className="mt-2 text-center text-[11px] text-muted">
              Running in mock mode · connect wallet for live USDC
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            Headless version: <code className="text-ink">npm run agent</code> in the repo.
          </p>
        </div>

        <div className="card min-h-80 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2">agent console</span>
            {running && (
              <span className="ml-auto animate-pulse text-primary">● live</span>
            )}
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {log.length === 0 && (
              <p className="text-muted">$ Press &quot;Run agent&quot; to start…</p>
            )}
            {log.map((l, i) => (
              <p key={i} className={color[l.kind]}>
                <span className="text-muted">›</span> {l.text}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["1 — Discover", "Agent fetches /api/agent to get the machine-readable catalog with prices and endpoints."],
          ["2 — 402 Challenge", "Every endpoint returns HTTP 402 with a payment challenge (amount, recipient, network)."],
          ["3 — Pay &amp; Retry", "Agent signs an EIP-3009 USDC authorization, retries — data arrives with an on-chain receipt ID."],
        ].map(([title, desc]) => (
          <div key={String(title)} className="card p-4">
            <p className="text-xs font-semibold text-primary">{title}</p>
            <p className="mt-1.5 text-xs text-muted">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
