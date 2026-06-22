"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Service } from "@/lib/types";
import { shortAddr } from "@/lib/format";
import { useWallet } from "@/components/wallet-provider";
import { WalletPanel } from "@/components/wallet-panel";
import { MyServices } from "@/components/my-services";
import { SellerTabs } from "@/components/seller-tabs";

export default function ProfilePage() {
  const w = useWallet();
  const [services, setServices] = useState<Service[]>([]);

  async function load() {
    const s = await fetch("/api/services").then((x) => x.json());
    setServices(s.services ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const myServices = useMemo(
    () => (w.address ? services.filter((s) => s.sellerAddress === w.address) : []),
    [services, w.address]
  );

  return (
    <div className="container-page py-10">
      <SellerTabs />

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="mt-1 text-base text-muted">
          {w.status === "connected"
            ? `Your account — ${shortAddr(w.address)}`
            : "Connect a wallet to view your balance and listings"}
        </p>
      </div>

      {/* Wallet — balance + withdraw */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:items-start">
        <WalletPanel />

        <div className="card p-6">
          <h2 className="text-lg font-semibold">Account</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Signed in as</dt>
              <dd className="font-medium text-ink">
                {w.status === "connected" ? (w.email ?? shortAddr(w.address)) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Wallet type</dt>
              <dd className="font-medium text-ink">
                {w.status !== "connected" ? "—" : w.demo ? "Demo wallet" : "Circle wallet · Arc"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Services listed</dt>
              <dd className="font-medium text-ink">{myServices.length}</dd>
            </div>
          </dl>
          <Link href="/sell" className="btn-primary mt-5 w-full">
            ➕ List a new service
          </Link>
        </div>
      </div>

      {/* My services management */}
      <div className="mt-6">
        <MyServices
          services={myServices}
          address={w.address}
          onChange={load}
          connected={w.status === "connected"}
        />
      </div>
    </div>
  );
}
