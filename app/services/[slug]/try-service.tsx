"use client";

import { useState } from "react";
import { useWallet } from "@/components/wallet-provider";

type Step = { label: string; status: number; body: unknown };

export function TryService({ endpoint, method, price }: { endpoint: string; method: "GET" | "POST"; price: string }) {
  const w = useWallet();
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setSteps([]);
    const opts = (withPayment: boolean): RequestInit => ({
      method,
      headers: {
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        ...(withPayment ? {
          "x-payment": btoa(JSON.stringify({ price, payer: w.address, ts: Date.now() })),
          "x-payer": w.address ?? "",
        } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify({ text: "hello" }) } : {}),
    });

    const r1 = await fetch(endpoint, opts(false));
    const b1 = await r1.json().catch(() => null);
    setSteps([{ label: "Request without payment", status: r1.status, body: b1 }]);

    const r2 = await fetch(endpoint, opts(true));
    const b2 = await r2.json().catch(() => null);
    setSteps((s) => [...s, { label: "Signed payment + retry", status: r2.status, body: { receiptId: r2.headers.get("x-receipt-id"), data: b2 } }]);
    setBusy(false);
  }

  return (
    <div className="mt-5">
      <button className="btn-primary w-full" onClick={run} disabled={busy || w.status !== "connected"}>
        {w.status !== "connected" ? "Connect wallet to try" : busy ? "Running…" : `Try it · ${price} USDC`}
      </button>
      {steps.map((s, i) => (
        <div key={i} className="mt-3 rounded-lg border border-line bg-bg p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{s.label}</span>
            <span className={s.status === 200 ? "font-bold text-mint" : "font-bold text-amber"}>{s.status}</span>
          </div>
          <pre className="mt-2 max-h-40 overflow-auto font-mono text-[11px] text-muted">{JSON.stringify(s.body, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}