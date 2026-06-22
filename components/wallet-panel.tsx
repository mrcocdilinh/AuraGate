"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./wallet-provider";
import { loadSessionCreds, runChallenge } from "@/lib/wallet-client";
import { shortAddr } from "@/lib/format";
import { ARC, explorerAddress } from "@/lib/arc";
import { readUsdcBalanceClient } from "@/lib/balance-client";
import { CopyButton } from "./ui";

interface Balance {
  usdc: string;
  configured: boolean;
  rpcError?: boolean;
}

/**
 * Wallet panel: shows the connected wallet's on-chain USDC balance and lets the
 * user withdraw (send) USDC to an external address via Circle's transfer flow.
 */
export function WalletPanel() {
  const w = useWallet();
  const [bal, setBal] = useState<Balance | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const refresh = useCallback(async () => {
    if (!w.address) return;
    setLoadingBal(true);
    // Read the balance directly from the browser → Arc RPC. Vercel's serverless
    // network can't always reach the Arc testnet RPC, but the user's browser can.
    const r = await readUsdcBalanceClient(w.address);
    setBal(r);
    setLoadingBal(false);
  }, [w.address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (w.status !== "connected" || !w.address) {
    return (
      <div className="card p-5">
        <h2 className="font-semibold">Your wallet</h2>
        <p className="mt-1 text-sm text-muted">
          Connect a wallet (email or Google) to see your USDC balance and withdraw.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Your wallet</h2>
        <span
          className={`badge ${w.demo ? "!border-amber/40 !text-amber" : "!border-mint/40 !text-mint"}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${w.demo ? "bg-amber" : "bg-mint"}`} />
          {w.demo ? "Demo wallet" : "Circle wallet · Arc"}
        </span>
      </div>

      {/* Address */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-bg/40 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted">Address</p>
          <p className="truncate font-mono text-sm text-ink">{shortAddr(w.address)}</p>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton text={w.address} label="copy" />
          <a
            href={explorerAddress(w.address)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Explorer ↗
          </a>
        </div>
      </div>

      {/* Balance */}
      <div className="mt-3 flex items-end justify-between rounded-lg border border-line bg-bg/40 px-3 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">USDC balance</p>
          <p className="mt-0.5 text-2xl font-bold text-ink">
            {bal?.configured && !bal.rpcError
              ? Number(bal.usdc).toLocaleString(undefined, { maximumFractionDigits: 6 })
              : "—"}
            <span className="ml-1 text-sm font-medium text-muted">USDC</span>
          </p>
        </div>
        <button onClick={refresh} className="btn-ghost !py-1.5 !px-3 text-xs" disabled={loadingBal}>
          {loadingBal ? "…" : "↻ Refresh"}
        </button>
      </div>
      {bal && !bal.configured && (
        <p className="mt-2 text-[11px] text-muted">
          USDC contract address not configured for this deployment.
        </p>
      )}
      {bal?.rpcError && (
        <p className="mt-2 text-[11px] text-amber">
          Could not reach Arc RPC — balance unavailable. Hit ↻ Refresh to try again.
        </p>
      )}

      {/* Withdraw */}
      {w.demo ? (
        <p className="mt-3 text-[11px] text-amber">
          This is a demo wallet (no Circle account configured) — it holds no real funds, so
          there&apos;s nothing to withdraw. Sign in with a real Circle wallet to move USDC.
        </p>
      ) : (
        <div className="mt-3">
          <button
            className="btn-primary w-full"
            onClick={() => setShowWithdraw((s) => !s)}
          >
            {showWithdraw ? "Close" : "↑ Withdraw USDC"}
          </button>
          {showWithdraw && <WithdrawForm onDone={refresh} />}
        </div>
      )}
    </div>
  );
}

const ADDR = /^0x[a-fA-F0-9]{40}$/;

function WithdrawForm({ onDone }: { onDone: () => void }) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    const creds = loadSessionCreds();
    if (!creds) {
      setMsg({
        ok: false,
        text: "Your secure session expired. Please log out and sign in again to withdraw.",
      });
      return;
    }
    if (!ADDR.test(to)) {
      setMsg({ ok: false, text: "Enter a valid destination address (0x…)." });
      return;
    }
    if (!(Number(amount) > 0)) {
      setMsg({ ok: false, text: "Enter an amount greater than 0." });
      return;
    }

    setBusy(true);
    try {
      // 1) Server creates the transfer → returns a challenge to authorize.
      const res = await fetch("/api/wallet/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userToken: creds.userToken, destinationAddress: to, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.challengeId) {
        setMsg({ ok: false, text: data.detail || data.error || "Could not start the withdrawal." });
        setBusy(false);
        return;
      }

      // 2) Client signs/authorizes the transfer (PIN-less confirms silently).
      setMsg({ ok: true, text: "Authorizing the transfer…" });
      await runChallenge(data.challengeId, creds);

      setMsg({ ok: true, text: "Withdrawal submitted ✓ — it'll appear on-chain shortly." });
      setTo("");
      setAmount("");
      setTimeout(onDone, 2500);
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof Error ? `Withdrawal failed — ${e.message}` : "Withdrawal failed.",
      });
    }
    setBusy(false);
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-line bg-bg/40 p-3">
      <p className="text-xs text-muted">
        Send USDC from your Circle wallet to any address on Arc (your exchange, MetaMask, etc.).
      </p>
      <input
        className="input"
        placeholder="Destination address (0x…)"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <input
        className="input"
        placeholder="Amount (USDC)"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button className="btn-primary w-full" onClick={submit} disabled={busy}>
        {busy ? "Processing…" : "Send withdrawal"}
      </button>
      {msg && (
        <p className={`text-center text-xs ${msg.ok ? "text-mint" : "text-danger"}`}>{msg.text}</p>
      )}
      <p className="text-center text-[11px] text-muted">
        Gas is paid in USDC on Arc · testnet — no real-world value.
      </p>
    </div>
  );
}
