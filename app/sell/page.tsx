"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet-provider";
import { SellerTabs } from "@/components/seller-tabs";
import { RegisterService } from "@/components/register-service";

export default function SellPage() {
  const w = useWallet();

  return (
    <div className="container-page py-10">
      <SellerTabs />

      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Sell an API</h1>
        <p className="mt-1.5 text-base text-muted">
          List any x402 endpoint and get paid in USDC per request — no application, no
          waitlist, no KYC. USDC lands directly in your wallet on every call.
        </p>

        {w.status !== "connected" && (
          <div className="mt-5 rounded-xl border border-amber/30 bg-amber/5 p-4 text-sm text-amber">
            You&apos;re not signed in. You can still fill the form, but connect a wallet
            (top-right) first so payments land at <strong>your</strong> address.
          </div>
        )}

        <div className="mt-6">
          <RegisterService address={w.address} sellerName={w.email} />
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Manage what you&apos;ve listed on your{" "}
          <Link href="/profile" className="text-primary hover:underline">Profile →</Link>
        </p>
      </div>
    </div>
  );
}
