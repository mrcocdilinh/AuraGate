import Link from "next/link";

export default function Home() {
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
            The marketplace for the{" "}
            <span className="gradient-text">agentic economy</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
            AI agents discover APIs, pay <strong className="text-ink">USDC per
            request</strong> with x402 — no API keys, no subscriptions — and get an
            on-chain receipt as proof of quality. Sellers list a service and get
            paid instantly.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/services" className="btn-primary w-full sm:w-auto">
              Browse marketplace
            </Link>
            <Link href="/playground" className="btn-ghost w-full sm:w-auto">
              Watch an agent pay →
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            Sign in with email or Google — a Circle wallet is created for you.
          </p>
        </div>

        {/* Flow strip */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-4">
          {[
            ["Discover", "Agent reads the catalog"],
            ["Request", "Server returns 402"],
            ["Pay", "Sign USDC authorization"],
            ["Receipt", "On-chain proof on Arc"],
          ].map(([t, d], i) => (
            <div key={t} className="card p-4 text-center">
              <div className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {i + 1}
              </div>
              <p className="font-semibold">{t}</p>
              <p className="mt-1 text-xs text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two sides */}
      <section className="container-page mt-24 grid gap-5 md:grid-cols-2">
        <div className="card p-7">
          <h3 className="text-xl font-bold">For AI agents & buyers</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <Li>Pay-per-call with USDC, gas-free via Circle Gateway nanopayments</Li>
            <Li>No accounts or API keys — payment is the access</Li>
            <Li>Spending limits enforced by Agent Wallet policy</Li>
            <Li>Every purchase returns a verifiable receipt</Li>
          </ul>
          <Link href="/playground" className="btn-ghost mt-6">
            Try the agent playground
          </Link>
        </div>
        <div className="card p-7">
          <h3 className="text-xl font-bold">For sellers</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted">
            <Li>List any API in minutes and set a per-request price</Li>
            <Li>Receive USDC on Arc, withdraw cross-chain</Li>
            <Li>Dashboard: revenue, payments, top buyers, ratings</Li>
            <Li>Reputation builds from on-chain receipts</Li>
          </ul>
          <Link href="/dashboard" className="btn-ghost mt-6">
            Open seller dashboard
          </Link>
        </div>
      </section>

      {/* Featured seller */}
      <section className="container-page mt-24">
        <div className="card relative overflow-hidden p-7 sm:p-10">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <span className="badge">First seller</span>
          <h3 className="mt-4 max-w-2xl text-2xl font-bold sm:text-3xl">
            AuraPredict joins as a paid <span className="gradient-text">market-insight API</span>
          </h3>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            The AuraPredict prediction-market indexer is listed on AuraGate as a
            paid oracle/insight service — proving the marketplace works with a real
            product, not just demos.
          </p>
          <Link href="/services/market-insight" className="btn-primary mt-6">
            View the service
          </Link>
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