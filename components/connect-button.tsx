"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "./wallet-provider";
import { useAccount, useDisconnect } from "wagmi";
import { shortAddr } from "@/lib/format";

export function ConnectButton() {
  const w = useWallet();
  const { address: extAddress, isConnected: extConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync external wallet (Reown/AppKit) into WalletProvider when connected
  useEffect(() => {
    if (extConnected && extAddress && w.status !== "connected") {
      w.loginWithExternalWallet(extAddress);
    }
  }, [extConnected, extAddress, w]);

  // Close dropdown on successful connect
  useEffect(() => {
    if (w.status === "connected" && open) setOpen(false);
  }, [w.status, open]);

  const handleLogout = useCallback(() => {
    if (extConnected) disconnect();
    w.logout();
  }, [extConnected, disconnect, w]);

  const openCryptoWallet = useCallback(async () => {
    setOpen(false);
    const { getModal } = await import("@/lib/reown");
    const modal = await getModal();
    (modal as any)?.open();
  }, []);

  if (w.status === "connected") {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/profile"
          className="badge !text-ink cursor-pointer hover:border-primary/40 transition"
          title="View your profile & wallet"
        >
          <span className={`h-2 w-2 rounded-full ${w.demo ? "bg-amber-400" : "bg-mint"}`} />
          {shortAddr(w.address)}
          {w.demo && (
            <span className="ml-1 text-[10px] font-semibold uppercase text-amber-400">demo</span>
          )}
          {w.method === "external" && (
            <span className="ml-1 text-[10px] font-semibold uppercase text-primary">ext</span>
          )}
        </Link>
        <button className="btn-ghost !py-2 !px-3" onClick={handleLogout}>
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

          {/* Modal — styled after AuraOn */}
          <div
            className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-[#1A2B4D] bg-[#0B1530] shadow-[0_0_0_1px_rgba(29,161,255,0.10),0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-[#00CBB8] uppercase">
                  Circle Wallet
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-[#F5F7FF]">
                  Sign in to AuraGate
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#101D3A] text-[#A9B9D6] hover:text-[#F5F7FF] transition"
              >
                <XIcon />
              </button>
            </div>

            {/* Info box */}
            <div className="mx-5 mb-4 rounded-xl border border-[#1A2B4D] bg-[#081126] px-3.5 py-3">
              <p className="text-[12px] font-semibold text-[#F5F7FF]">
                Secure Arc wallet, no extension required.
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#A9B9D6]">
                We create a PIN-protected Circle wallet for you. Your keys stay
                private and are never shared with AuraGate.
              </p>
            </div>

            <div className="px-5 pb-5 space-y-2">
              {/* Connect crypto wallet (Reown / EVE / MetaMask …) */}
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-[#1A2B4D] bg-[#101D3A] px-4 py-3 text-sm font-medium text-[#F5F7FF] transition hover:border-[#264573] hover:bg-[#0D1730] active:scale-[0.98]"
                onClick={openCryptoWallet}
              >
                <WalletIcon />
                Connect a crypto wallet
              </button>

              {/* Google */}
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-[#1A2B4D] bg-[#101D3A] px-4 py-3 text-sm font-medium text-[#F5F7FF] transition hover:border-[#264573] hover:bg-[#0D1730] active:scale-[0.98] disabled:opacity-50"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await w.loginWithGoogle();
                  setBusy(false);
                }}
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-2 py-1 text-[11px] text-[#6E7D99]">
                <span className="flex-1 border-t border-[#1A2B4D]" />
                OR
                <span className="flex-1 border-t border-[#1A2B4D]" />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-[#A9B9D6]">
                  Email address
                </label>
                <input
                  className="w-full rounded-xl border border-[#1A2B4D] bg-[#0D1730] px-3.5 py-2.5 text-sm text-[#F5F7FF] outline-none placeholder:text-[#6E7D99] focus:border-[#4CB8FF] focus:shadow-[0_0_0_3px_rgba(29,161,255,0.12)] transition"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email.includes("@")) {
                      setBusy(true);
                      w.loginWithEmail(email).finally(() => setBusy(false));
                    }
                  }}
                />
                <button
                  className="w-full rounded-xl bg-[#0A7CFF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1DA1FF] active:scale-[0.98] disabled:opacity-50 shadow-[0_0_18px_rgba(10,124,255,0.30)]"
                  disabled={busy || !email.includes("@")}
                  onClick={async () => {
                    setBusy(true);
                    await w.loginWithEmail(email);
                    setBusy(false);
                  }}
                >
                  Continue with email
                </button>
              </div>

              {w.error && (
                <p className="text-[11px] leading-relaxed text-danger">{w.error}</p>
              )}

              {w.demo && (
                <p className="text-[11px] leading-relaxed text-[#6E7D99]">
                  Demo mode — set{" "}
                  <code className="text-[#A9B9D6]">CIRCLE_API_KEY</code> &{" "}
                  <code className="text-[#A9B9D6]">NEXT_PUBLIC_CIRCLE_APP_ID</code> for real wallets.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="#A9B9D6" strokeWidth="1.6" />
      <path d="M16 2H6a2 2 0 00-2 2v2h16V4a2 2 0 00-2-2z" stroke="#A9B9D6" strokeWidth="1.6" />
      <circle cx="17" cy="13" r="1.5" fill="#3E73FF" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
