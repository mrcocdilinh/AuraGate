"use client";

import { useState } from "react";
import { useWallet } from "./wallet-provider";
import { loadSessionCreds, runChallenge } from "@/lib/wallet-client";
import { usd } from "@/lib/format";
import { CopyButton } from "./ui";

type Phase = "idle" | "initiating" | "signing" | "fetching" | "done" | "error";

interface BuyResult {
  data: unknown;
  receipt: {
    id: string;
    serviceSlug: string;
    payer: string;
    amount: string;
    resultHash: string;
    createdAt: string;
  };
}

/**
 * "Buy with wallet" button for service detail pages.
 * Connects to Circle's real USDC transfer flow — actual USDC moves on Arc.
 * Only available for AuraGate-hosted services (not external seller endpoints).
 */
export function BuyWithWallet({
  slug,
  price,
  external = false,
}: {
  slug: string;
  price: string;
  external?: boolean;
}) {
  const w = useWallet();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<BuyResult | null>(null);

  // External seller endpoints require raw EIP-3009 signing — not supported in browser.
  if (external) {
    return (
      <div className="mt-3 rounded-lg border border-line bg-bg/40 p-3 text-xs text-muted">
        <p className="font-semibold text-ink">Seller-hosted endpoint</p>
        <p className="mt-1">
          This service runs on the seller&apos;s own server — browser wallet payment isn&apos;t
          supported for external endpoints. Use the{" "}
          <code className="text-ink">curl</code> snippet above or the headless agent:
        </p>
        <code className="mt-1 block text-[11px] text-primary">npm run agent</code>
      </div>
    );
  }

  // Not connected — soft prompt.
  if (w.status !== "connected") {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-line p-3 text-center text-xs text-muted">
        Connect a Circle wallet to pay USDC directly →{" "}
        <span className="text-ink">click "Connect wallet" above</span>
      </div>
    );
  }

  // Demo wallet — can't do real transfers.
  if (w.demo) {
    return (
      <div className="mt-3 rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs text-amber">
        Connected in demo mode — no Circle account configured, so real USDC can&apos;t move.
        Use the <strong>Try it now</strong> button above for a simulated flow.
      </div>
    );
  }

  if (result) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-mint">
            ✓ Paid {usd(result.receipt.amount)} · data received
          </p>
          <button
            className="text-[11px] text-muted hover:text-ink"
            onClick={() => { setResult(null); setPhase("idle"); }}
          >
            Buy again
          </button>
        </div>
        <div className="rounded-lg border border-mint/20 bg-bg p-3">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>Receipt ID: <span className="font-mono text-ink">{result.receipt.id.slice(0, 12)}…</span></span>
            <CopyButton text={result.receipt.id} label="copy" />
          </div>
          <pre className="mt-2 max-h-52 overflow-auto font-mono text-[11px] text-mint">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  const phaseLabel: Record<Phase, string> = {
    idle: `💳 Buy with wallet · ${usd(price)} USDC`,
    initiating: "Setting up transfer…",
    signing: "Waiting for Circle to confirm…",
    fetching: "Fetching your data…",
    done: "Done!",
    error: `💳 Buy with wallet · ${usd(price)} USDC`,
  };

  async function buy() {
    setError("");
    setPhase("initiating");

    const creds = loadSessionCreds();
    if (!creds) {
      setError("Your session expired — please log out and sign in again.");
      setPhase("error");
      return;
    }

    // 1. Server creates the USDC transfer → returns challengeId + pendingId.
    const initRes = await fetch("/api/buy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, userToken: creds.userToken }),
    });
    const initData = await initRes.json().catch(() => ({}));
    if (!initRes.ok || !initData.challengeId) {
      setError(initData.detail || initData.error || "Could not start the purchase.");
      setPhase("error");
      return;
    }

    // 2. Client authorises the transfer via Circle SDK challenge.
    setPhase("signing");
    try {
      await runChallenge(initData.challengeId, creds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge failed — payment not sent.");
      setPhase("error");
      return;
    }

    // 3. Confirm on server → get live data + receipt.
    setPhase("fetching");
    const confirmRes = await fetch("/api/buy/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingId: initData.pendingId, walletAddress: w.address }),
    });
    const confirmData = await confirmRes.json().catch(() => ({}));
    if (!confirmRes.ok || !confirmData.data) {
      setError(confirmData.detail || confirmData.error || "Could not deliver data.");
      setPhase("error");
      return;
    }

    setResult(confirmData as BuyResult);
    setPhase("done");
  }

  const busy = phase !== "idle" && phase !== "error";

  return (
    <div className="mt-3">
      <button className="btn-primary w-full" onClick={buy} disabled={busy}>
        {phaseLabel[phase]}
        {busy && <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
      </button>
      <p className="mt-1 text-center text-[11px] text-muted">
        Real USDC · Arc testnet · receipt on-chain
      </p>
      {error && (
        <p className="mt-2 text-center text-[11px] text-danger">{error}</p>
      )}
    </div>
  );
}
