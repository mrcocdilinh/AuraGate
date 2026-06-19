import Link from "next/link";
import { notFound } from "next/navigation";
import { getService, listReceipts } from "@/lib/store";
import { usd } from "@/lib/format";
import { CategoryPill, Stars } from "@/components/ui";
import { TryService } from "./try-service";

export const dynamic = "force-dynamic";

export default async function ServiceDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [service, allReceipts] = await Promise.all([
    getService(slug),
    listReceipts(),
  ]);
  if (!service) notFound();

  const receipts = allReceipts.filter((r) => r.serviceSlug === slug);
  const rated = receipts.filter((r) => r.rating);
  const avg =
    rated.length > 0
      ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length
      : 0;

  return (
    <div className="container-page py-10">
      <Link href="/services" className="text-sm text-muted hover:text-ink">
        ← Marketplace
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <CategoryPill category={service.category} />
            <span className="badge !text-ink">by {service.sellerName}</span>
            {rated.length > 0 && (
              <span className="badge !text-ink">
                <Stars value={avg} /> {avg.toFixed(1)} ({rated.length})
              </span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold">{service.name}</h1>
          <p className="mt-3 text-muted">{service.description}</p>

          <div className="card mt-6 p-5">
            <p className="text-xs uppercase tracking-wide text-muted">How to call (curl)</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-4 font-mono text-xs text-mint">
{`# Step 1 — hit the endpoint, receive 402
curl -i ${service.endpoint}

# Step 2 — add X-PAYMENT header and retry
curl -X ${service.method} ${service.endpoint} \\
  -H "X-PAYMENT: <signed-eip3009-authorization>" \\
  -H "X-PAYER: <your-wallet-address>"`}
            </pre>
          </div>

          <div className="card mt-4 p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Sample response</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-4 font-mono text-xs text-mint">
              {JSON.stringify(service.sampleResponse, null, 2)}
            </pre>
          </div>

          {receipts.length > 0 && (
            <div className="card mt-4 p-5">
              <p className="text-xs uppercase tracking-wide text-muted">
                Recent receipts ({receipts.length})
              </p>
              <div className="mt-3 space-y-2">
                {receipts.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted">{r.payer.slice(0, 10)}…</span>
                    <span className="text-mint">{usd(r.amount)}</span>
                    {r.rating && <Stars value={r.rating} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-6">
            <p className="text-sm text-muted">Price per request</p>
            <p className="mt-1 text-4xl font-extrabold text-mint">
              {usd(service.price)}
            </p>
            <p className="mt-1 text-xs text-muted">USDC · settled on Arc via x402</p>
            <TryService
              endpoint={service.endpoint}
              method={service.method}
              price={service.price}
            />
            <Link href="/playground" className="btn-ghost mt-3 w-full">
              Buy with the agent →
            </Link>
          </div>

          <div className="card p-5 text-sm">
            <p className="font-semibold">How payment works</p>
            <ol className="mt-3 space-y-2 text-muted">
              <li>1. Call the endpoint → server replies <code className="text-ink">402</code></li>
              <li>2. Sign a USDC authorization (EIP-3009)</li>
              <li>3. Retry → receive data + on-chain receipt</li>
            </ol>
          </div>

          <div className="card p-5 text-sm">
            <p className="font-semibold">Stats</p>
            <div className="mt-3 space-y-1.5 text-muted">
              <div className="flex justify-between">
                <span>Total calls</span>
                <span className="text-ink">{receipts.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total revenue</span>
                <span className="text-mint">
                  {usd(receipts.reduce((a, r) => a + Number(r.amount), 0))}
                </span>
              </div>
              {rated.length > 0 && (
                <div className="flex justify-between">
                  <span>Avg rating</span>
                  <span className="text-ink">{avg.toFixed(1)} / 5</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
