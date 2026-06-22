"use client";

import Link from "next/link";
import { useState } from "react";
import type { Service } from "@/lib/types";
import { usd } from "@/lib/format";
import { VerifiedBadge } from "@/components/ui";
import { loadSessionCreds } from "@/lib/wallet-client";

/** Table of the services listed under the connected wallet, with manage actions. */
export function MyServices({
  services,
  address,
  onChange,
  connected,
}: {
  services: Service[];
  address?: string;
  onChange: () => void;
  connected: boolean;
}) {
  const [busy, setBusy] = useState("");

  async function toggle(slug: string, active: boolean) {
    setBusy(slug);
    const creds = loadSessionCreds();
    await fetch("/api/services", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, active, sellerAddress: address, userToken: creds?.userToken }),
    });
    await onChange();
    setBusy("");
  }

  async function remove(slug: string) {
    if (!confirm(`Delete "${slug}" from the registry? This cannot be undone.`)) return;
    setBusy(slug);
    const creds = loadSessionCreds();
    await fetch("/api/services", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, sellerAddress: address, userToken: creds?.userToken }),
    });
    await onChange();
    setBusy("");
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-5">
        <h2 className="text-lg font-semibold">My services</h2>
        <span className="text-sm text-muted">{services.length} listed under this wallet</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr className="border-y border-line">
              <th className="px-5 py-3">Service</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Endpoint</th>
              <th className="px-5 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.slug} className="border-b border-line/60">
                <td className="px-5 py-3">
                  <Link href={`/services/${s.slug}`} className="font-medium hover:text-primary">
                    {s.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-mint">{usd(s.price)}</td>
                <td className="px-5 py-3">
                  <VerifiedBadge verified={s.verified} hosted={s.externalUrl ? "seller" : "auragate"} />
                </td>
                <td className="px-5 py-3 max-w-[180px] truncate font-mono text-[11px] text-muted">
                  {s.endpoint}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex gap-3">
                    <button
                      className="text-xs text-muted hover:text-ink disabled:opacity-40"
                      disabled={busy === s.slug}
                      onClick={() => toggle(s.slug, !s.active)}
                    >
                      {s.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="text-xs text-danger hover:underline disabled:opacity-40"
                      disabled={busy === s.slug}
                      onClick={() => remove(s.slug)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                  {connected ? (
                    <>
                      No services under this wallet yet —{" "}
                      <Link href="/sell" className="text-primary hover:underline">list one →</Link>
                    </>
                  ) : (
                    "Connect a wallet to see services you've listed."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
