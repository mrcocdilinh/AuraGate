"use client";

import { useState } from "react";

// Demo payer recognised by the server's x402 bypass, so "Try it" works even
// when Vercel runs in live mode — no real USDC moves, no wallet needed.
const DEMO_AGENT = "0xDemoAgent0000000000000000000000000000001";

type Step = { label: string; status: number; body: unknown };

export function TryService({
  endpoint,
  method,
  price,
  external = false,
}: {
  endpoint: string;
  method: "GET" | "POST";
  price: string;
  external?: boolean;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true);
    setSteps([]);
    setErr("");
    const opts = (withPayment: boolean): RequestInit => ({
      method,
      headers: {
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        ...(withPayment
          ? {
              "x-payment": btoa(JSON.stringify({ price, payer: DEMO_AGENT, ts: Date.now() })),
              "x-payer": DEMO_AGENT,
            }
          : {}),
      },
      ...(method === "POST"
        ? { body: JSON.stringify({ text: "AuraGate lets AI agents pay USDC per request using the open x402 protocol on Arc testnet, with on-chain receipts as proof." }) }
        : {}),
    });

    try {
      const r1 = await fetch(endpoint, opts(false));
      const b1 = await r1.json().catch(() => null);
      setSteps([{ label: "1. Request without paying → server asks for payment", status: r1.status, body: b1 }]);

      const r2 = await fetch(endpoint, opts(true));
      const b2 = await r2.json().catch(() => null);
      setSteps((s) => [
        ...s,
        {
          label: "2. Pay + retry → data arrives with a receipt",
          status: r2.status,
          body: { receiptId: r2.headers.get("x-receipt-id"), data: b2 },
        },
      ]);
    } catch (e) {
      setErr(
        external
          ? "Couldn't reach the seller-hosted endpoint (CORS or offline). Agents call it server-side — this in-browser demo may be blocked."
          : e instanceof Error
            ? e.message
            : "Request failed"
      );
    }
    setBusy(false);
  }

  return (
    <div className="mt-5">
      <button className="btn-primary w-full" onClick={run} disabled={busy}>
        {busy ? "Running…" : `▶ Try it now · ${price} USDC`}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">
        Free demo — no wallet or real money needed
      </p>
      {external && (
        <p className="mt-2 text-[11px] text-muted">
          Seller-hosted endpoint — receipts are issued by the seller, not AuraGate.
        </p>
      )}
      {err && <p className="mt-2 text-[11px] text-amber">{err}</p>}
      {steps.map((s, i) => (
        <div key={i} className="mt-3 rounded-lg border border-line bg-bg p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">{s.label}</span>
            <span className={s.status === 200 ? "font-bold text-mint" : "font-bold text-amber"}>
              {s.status}
            </span>
          </div>
          <pre className="mt-2 max-h-48 overflow-auto font-mono text-[11px] text-muted">
            {JSON.stringify(s.body, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
