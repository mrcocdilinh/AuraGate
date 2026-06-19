"use client";

import { useEffect, useState } from "react";
import type { Receipt } from "@/lib/types";
import { usd, shortAddr, timeAgo } from "@/lib/format";
import { ARC, explorerTx } from "@/lib/arc";
import { Stars } from "@/components/ui";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  async function load() {
    const r = await fetch("/api/receipts").then((x) => x.json());
    setReceipts(r.receipts ?? []);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function rate(id: string, rating: number) {
    await fetch("/api/receipts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, rating }),
    });
    load();
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Receipt explorer</h1>
      <p className="mt-1 text-sm text-muted">
        Every paid request is a verifiable receipt — payer, amount and a hash of
        the result. Rate a service to build seller reputation.
      </p>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Payer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Result hash</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Rate</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-middle">
                  <td className="px-4 py-3 font-medium">{r.serviceSlug}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {shortAddr(r.payer)}
                  </td>
                  <td className="px-4 py-3 text-mint">{usd(r.amount)}</td>
                  <td className="px-4 py-3">
                    {r.onchainTx ? (
                      <a
                        href={explorerTx(r.onchainTx)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.resultHash.slice(0, 10)}…
                      </a>
                    ) : (
                      <span
                        className="font-mono text-xs text-muted"
                        title={r.resultHash}
                      >
                        {r.resultHash.slice(0, 10)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {timeAgo(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {r.rating ? (
                      <Stars value={r.rating} />
                    ) : (
                      <div className="flex gap-1 text-muted">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            className="hover:text-amber"
                            onClick={() => rate(r.id, n)}
                            title={`Rate ${n}`}
                          >
                            ☆
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No receipts yet. Buy a service to create the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        On-chain receipts settle to the ReceiptRegistry on Arc Testnet (
        <span className="font-mono">{ARC.caip2}</span>).
      </p>
    </div>
  );
}