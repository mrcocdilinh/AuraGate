import Link from "next/link";
import { getSellers } from "@/lib/store";
import { usd, shortAddr } from "@/lib/format";
import { explorerAddress } from "@/lib/arc";
import { ReputationBar, Stars } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sellers · AuraGate",
  description: "Reputation leaderboard for x402 service sellers on Arc.",
};

export default async function SellersPage() {
  const sellers = await getSellers();

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">Seller reputation</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Reputation is earned, not assigned. Each seller&apos;s score (0–100)
        blends average rating, demand and how much of their catalog passed a live
        x402 health-check — all derived from on-chain receipts.
      </p>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Reputation</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Services</th>
                <th className="px-4 py-3">Calls</th>
                <th className="px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s, i) => (
                <tr key={s.address} className="border-b border-line/60">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <a
                      href={explorerAddress(s.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-muted hover:text-primary"
                    >
                      {shortAddr(s.address)}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <ReputationBar score={s.reputation} />
                  </td>
                  <td className="px-4 py-3">
                    {s.avgRating !== null ? (
                      <span className="flex items-center gap-1.5">
                        <Stars value={s.avgRating} />
                        <span className="text-xs text-muted">
                          {s.avgRating.toFixed(1)} ({s.ratedCount})
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">no ratings</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {s.services}
                    {s.verifiedServices > 0 && (
                      <span className="ml-1 text-[11px] text-mint">
                        ({s.verifiedServices}✓)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{s.calls}</td>
                  <td className="px-4 py-3 font-semibold text-mint">{usd(s.revenue)}</td>
                </tr>
              ))}
              {sellers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No sellers yet.{" "}
                    <Link href="/dashboard" className="text-primary hover:underline">
                      List the first service →
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Rating · 50%", "Average of buyer star ratings on settled receipts, normalised to 50 points."],
          ["Demand · 30%", "Paid call volume, scaled up to 50 calls for the full 30 points."],
          ["Verified · 20%", "Share of a seller's endpoints that returned a valid 402 challenge."],
        ].map(([t, d]) => (
          <div key={String(t)} className="card p-4">
            <p className="text-xs font-semibold text-primary">{t}</p>
            <p className="mt-1.5 text-xs text-muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
