"use client";

import { useState } from "react";
import { useWallet } from "@/components/wallet-provider";
import { usd } from "@/lib/format";

interface LogLine {
  kind: "info" | "402" | "pay" | "data" | "done";
  text: string;
}

export default function PlaygroundPage() {
  const w = useWallet();
  const [log, setLog] = useState<LogLine[]>([]);
  const [spent, setSpent] = useState(0);
  const [limit, setLimit] = useState("0.10");
  const [running, setRunning] = useState(false);

  function push(line: LogLine) {
    setLog((l) => [...l, line]);
  }

  async function run() {
    setRunning(true);
    setLog([]);
    setSpent(0);
    const cap = Number(limit);
    let total = 0;

    push({ kind: "info", text: "Reading AuraGate agent catalog…" });
    const manifest = await fetch("/api/agent").then((r) => r.json());
    const services: Array<{ id: string; name: string; url: string; price: { amount: string } }> =
      manifest.services ?? [];
    push({ kind: "info", text: `Found ${services.length} services. Spending limit ${usd(cap)}.` });

    for (const s of services) {
      const price = Number(s.price.amount);
      if (total + price > cap) {
        push({ kind: "info", text: `Skipping ${s.name} — would exceed limit.` });
        continue;
      }

      // 1) hit endpoint, expect 402
      const r1 = await fetch(s.url);
      push({ kind: "402", text: `${s.name}: ${r1.status} Payment Required (${usd(price)})` });

      // 2) sign + retry
      const r2 = await fetch(s.url, {
        headers: {
          "x-payment": btoa(JSON.stringify({ price: s.price.amount, payer: w.address })),
          "x-payer": w.address ?? "",
        },
      });
      const receiptId = r2.headers.get("x-receipt-id");
      total += price;
      setSpent(total);
      push({ kind: "pay", text: `Paid ${usd(price)} → receipt ${receiptId?.slice(0, 8)}…` });
      const data = await r2.json().catch(() => null);
      push({
        kind: "data",
        text: `Received: ${JSON.stringify(data).slice(0, 90)}…`,
      });
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
  };

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Agent playground</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Watch an autonomous agent discover services, pay USDC per request with a
        spending limit, and collect receipts — the full x402 loop, live.
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
          <button
            className="btn-primary mt-4 w-full"
            onClick={run}
            disabled={running || w.status !== "connected"}
          >
            {w.status !== "connected"
              ? "Connect wallet to run"
              : running
                ? "Agent working…"
                : "Run agent"}
          </button>
          <p className="mt-3 text-[11px] text-muted">
            The headless version of this agent lives in{" "}
            <code className="text-ink">agent/run.mts</code> and uses Circle&apos;s
            GatewayClient + Claude.
          </p>
        </div>

        <div className="card min-h-80 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2">agent console</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {log.length === 0 && (
              <p className="text-muted">$ waiting to run…</p>
            )}
            {log.map((l, i) => (
              <p key={i} className={color[l.kind]}>
                <span className="text-muted">›</span> {l.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}