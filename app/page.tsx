import Link from "next/link";
import { listServices, listAllReceipts, getSellers } from "@/lib/store";
import { usd, shortAddr } from "@/lib/format";
import { ReputationBar, Stars } from "@/components/ui";
import { isTrustedReceipt } from "@/lib/trust";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [services, receipts, sellers] = await Promise.all([
    listServices(),
    listAllReceipts(),
    getSellers(),
  ]);
  const trustedReceipts = receipts.filter(isTrustedReceipt);
  const revenue = trustedReceipts.reduce((a, r) => a + Number(r.amount), 0);
  const buyers = new Set(trustedReceipts.map((r) => r.payer)).size;
  const topSellers = sellers.slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="container-page pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="badge mx-auto">
            <span className="h-2 w-2 rounded-full bg-mint" />
            Built on Arc · powered by x402 + Circle Gateway
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            The app store where{" "}
            <span className="gradient-text">AI buys what it needs</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
            AuraGate is a marketplace of data &amp; APIs where{" "}
            <strong className="text-ink">AI agents pay for what they use</strong> —
            a few cents in USDC per request, no sign-up and no API key. Every
            purchase leaves a{" "}
            <strong className="text-ink">receipt on the blockchain</strong> as proof.
            Anyone can sell; trust is earned from real usage, not a gatekeeper.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/services" className="btn-primary w-full sm:w-auto">
              Browse the marketplace
            </Link>
            <Link href="/docs" className="btn-ghost w-full sm:w-auto">
              How to buy &amp; sell →
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            Machine-readable catalog at{" "}
            <Link href="/api/agent" className="text-ink underline-offset-2 hover:underline">
              /api/agent
            </Link>{" "}
            · sign in with email or Google for a Circle wallet
          </p>
        </div>

        {/* Live stats bar */}
        <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-6 rounded-2xl border border-line bg-panel/50 px-8 py-5 text-center">
          {[
            ["Services", services.length],
            ["Requests paid", trustedReceipts.length],
            ["Revenue (USDC)", usd(revenue)],
            ["Unique buyers", buyers],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <p className="text-2xl font-bold text-ink">{val}</p>
              <p className="mt-0.5 text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* How it works — plain language */}
        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-center text-lg font-semibold">How a purchase works — in 4 simple steps</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              ["Find", "An AI agent browses the catalog and picks a service it needs."],
              ["Ask", "It requests the data. The service replies: “pay first, please.”"],
              ["Pay", "The agent pays a few cents in USDC — automatically, no human, no card."],
              ["Receive", "It gets the data plus a blockchain receipt proving the payment."],
            ].map(([t, d], i) => (
              <div key={String(t)} className="card p-4 text-center">
                <div className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-xs text-muted">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            Powered by the open <span className="text-ink">x402</span> standard +
            Circle Gateway. Developers: the machine-readable catalog lives at{" "}
            <Link href="/api/agent" className="text-ink underline-offset-2 hover:underline">/api/agent</Link>.
          </p>
        </div>
      </section>

      {/* Differentiator: open vs curated */}
      <section className="container-page mt-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            The <span className="gradient-text">permissionless</span> layer of the agent economy
          </h2>
          <p className="mt-3 text-sm text-muted">
            Curated marketplaces decide who gets to sell. AuraGate doesn&apos;t —
            trust comes from on-chain receipts and ratings instead of a gatekeeper.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Open registration", "List a service in minutes by pointing at your own x402 endpoint. No application, no waitlist.", "∞"],
            ["On-chain receipts", "Every paid request hashes the result and settles to the ReceiptRegistry contract on Arc — independently verifiable.", "⛓"],
            ["Earned reputation", "Buyers rate each receipt. Seller scores blend rating quality, demand and verified coverage.", "★"],
          ].map(([t, d, icon]) => (
            <div key={String(t)} className="card p-6">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 text-lg">
                {icon}
              </div>
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top sellers leaderboard teaser */}
      {topSellers.length > 0 && (
        <section className="container-page mt-24">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">Top sellers by reputation</h2>
              <p className="mt-1 text-sm text-muted">Reputation is earned from real, rated, on-chain receipts.</p>
            </div>
            <Link href="/sellers" className="btn-ghost hidden sm:inline-flex">
              Full leaderboard →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {topSellers.map((s, i) => (
              <div key={s.address} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted">#{i + 1}</span>
                  <ReputationBar score={s.reputation} />
                </div>
                <p className="mt-3 font-semibold">{s.name}</p>
                <p className="font-mono text-xs text-muted">{shortAddr(s.address)}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>{s.services} svc · {s.calls} calls</span>
                  {s.avgRating !== null ? (
                    <span className="flex items-center gap-1">
                      <Stars value={s.avgRating} />
                    </span>
                  ) : (
                    <span>no ratings</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Two sides */}
      <section className="container-page mt-24 grid gap-5 md:grid-cols-2">
        <div className="card p-7">
          <h3 className="text-xl font-bold">If you build AI agents (buyers)</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <Li>Your agent pays per request in USDC — no gas fees</Li>
            <Li>No accounts or API keys to manage — paying is the login</Li>
            <Li>Set a spending limit so it never overspends</Li>
            <Li>Every purchase comes with a blockchain receipt</Li>
          </ul>
          <Link href="/playground" className="btn-ghost mt-6">
            Watch an agent buy →
          </Link>
        </div>
        <div className="card p-7">
          <h3 className="text-xl font-bold">If you have an API to sell (sellers)</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <Li>List your service in minutes and set your own price</Li>
            <Li>Get paid in USDC the moment someone uses it</Li>
            <Li>Dashboard shows your revenue, buyers and ratings</Li>
            <Li>Build a reputation score from real, rated usage</Li>
          </ul>
          <Link href="/dashboard" className="btn-ghost mt-6">
            Open seller dashboard →
          </Link>
        </div>
      </section>

      {/* Become a seller */}
      <section className="container-page mt-24 pb-24">
        <div className="card relative overflow-hidden p-7 sm:p-10">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <span className="badge">Open registry</span>
          <h3 className="mt-4 max-w-2xl text-2xl font-bold sm:text-3xl">
            List your own API and{" "}
            <span className="gradient-text">get paid per request</span>
          </h3>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Anyone can sell — no application, no waitlist, no KYC. Host an x402
            endpoint (or use a free hosted demo), register it in a minute, and USDC
            lands in your wallet the moment an agent calls it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/sell" className="btn-primary">
              Sell your API →
            </Link>
            <Link href="/services" className="btn-ghost">
              Browse all {services.length} services →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1 text-mint">✓</span>
      <span>{children}</span>
    </li>
  );
}
