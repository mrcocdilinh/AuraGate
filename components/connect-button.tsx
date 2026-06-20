"use client";

import { useState, useEffect } from "react";
import { useWallet } from "./wallet-provider";
import { shortAddr } from "@/lib/format";

export function ConnectButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Auto-close dropdown only on successful connect, not on error.
  useEffect(() => {
    if (w.status === "connected" && open) setOpen(false);
  }, [w.status, open]);

  if (w.status === "connected") {
    return (
      <div className="flex items-center gap-2">
        <button
          className="badge !text-ink cursor-pointer hover:border-primary/40 transition"
          title="Click to copy address"
          onClick={() => navigator.clipboard.writeText(w.address ?? "")}
        >
          <span className={`h-2 w-2 rounded-full ${w.demo ? "bg-amber-400" : "bg-mint"}`} />
          {shortAddr(w.address)}
          {w.demo && (
            <span className="ml-1 text-[10px] font-semibold uppercase text-amber-400">demo</span>
          )}
        </button>
        <button className="btn-ghost !py-2 !px-3" onClick={w.logout}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="btn-primary"
        onClick={() => setOpen((o) => !o)}
        disabled={w.status === "connecting"}
      >
        {w.status === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="card absolute right-0 z-50 mt-2 w-72 p-4 shadow-glow">
            <p className="text-sm font-semibold">Sign in to AuraGate</p>
            <p className="mt-1 text-xs text-muted">
              Email or Google — a Circle wallet is created for you. No seed phrase.
            </p>

            <button
              className="btn-ghost mt-3 w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await w.loginWithGoogle();
                setBusy(false);
              }}
            >
              <GoogleIcon /> Continue with Google
            </button>

            <div className="my-3 flex items-center gap-2 text-[11px] text-muted">
              <span className="hairline flex-1" /> or <span className="hairline flex-1" />
            </div>

            <input
              className="input"
              placeholder="you@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="btn-primary mt-2 w-full"
              disabled={busy || !email.includes("@")}
              onClick={async () => {
                setBusy(true);
                await w.loginWithEmail(email);
                setBusy(false);
              }}
            >
              Continue with email
            </button>

            {w.error && (
              <p className="mt-3 text-[11px] leading-relaxed text-danger">
                {w.error}
              </p>
            )}
            {w.demo && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Demo mode — set <code className="text-ink">CIRCLE_API_KEY</code>,{" "}
                <code className="text-ink">NEXT_PUBLIC_CIRCLE_APP_ID</code> &{" "}
                <code className="text-ink">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to
                use real Circle wallets.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.4 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
