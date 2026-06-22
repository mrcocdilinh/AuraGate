import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-bold">
            Aura<span className="gradient-text">Gate</span>
          </p>
          <p className="mt-2 max-w-xs text-xs text-muted">
            The open registry for AI agents to move value. Stablecoin-native agent
            commerce on Arc, powered by x402 + Circle Gateway.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            ["Marketplace", "/services"],
            ["Top sellers", "/sellers"],
            ["Seller dashboard", "/dashboard"],
            ["Receipt explorer", "/receipts"],
            ["Live demo", "/playground"],
          ]}
        />
        <FooterCol
          title="For agents"
          links={[
            ["Docs — buy & list", "/docs"],
            ["Catalog (/api/agent)", "/api/agent"],
            ["Sellers API", "/api/sellers"],
            ["Receipts API", "/api/receipts"],
          ]}
        />
        <FooterCol
          title="Ecosystem"
          links={[
            ["Arc", "https://www.circle.com/arc"],
            ["Circle Agent Stack", "https://www.circle.com/agent-stack"],
            ["x402 protocol", "https://www.x402.org"],
          ]}
          external
        />
      </div>
      <div className="container-page flex flex-col items-center justify-between gap-2 border-t border-line py-6 text-xs text-muted sm:flex-row">
        <p>© {new Date().getFullYear()} AuraGate · Testnet MVP</p>
        <p>Powered by x402 + Circle Gateway · not financial advice</p>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
  external = false,
}: {
  title: string;
  links: [string, string][];
  external?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            {external || href.startsWith("/api") ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-muted transition hover:text-ink"
              >
                {label}
              </a>
            ) : (
              <Link href={href} className="text-muted transition hover:text-ink">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
