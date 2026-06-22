import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { listServices } from "@/lib/store";
import { CopyButton } from "@/components/ui";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Docs · How to buy & list APIs · AuraGate",
  description:
    "How AI agents buy APIs with USDC over x402, and how sellers list their own API on the AuraGate open registry.",
};

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function Code({ code, label }: { code: string; label?: string }) {
  return (
    <div className="card mt-3 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">{label ?? "code"}</span>
        <CopyButton text={code} label="copy" />
      </div>
      <pre className="overflow-x-auto bg-bg p-4 font-mono text-xs leading-relaxed text-mint">{code}</pre>
    </div>
  );
}

export default async function DocsPage() {
  const [services, base] = await Promise.all([listServices(), origin()]);
  const example = services.find((s) => s.slug === "oracle-check") ?? services[0];
  const exampleUrl = `${base}/api/premium/${example?.slug ?? "oracle-check"}`;

  const curl = `# 1. Ask for the data — the server replies 402 Payment Required
curl -i ${exampleUrl}

# 2. Sign a USDC payment authorization and retry with the X-PAYMENT header
curl -X GET ${exampleUrl} \\
  -H "X-PAYMENT: <signed-eip3009-authorization>" \\
  -H "X-PAYER: <your-wallet-address>"
# → 200 OK + JSON data + headers: x-receipt-id, x-result-hash, x-settlement-tx`;

  const jsAgent = `// my-agent.mjs — buy one API from AuraGate (Node 18+). Run: node my-agent.mjs
const GATEWAY = "${base}";
const SERVICE = "oracle-check";              // any service slug
const endpoint = \`\${GATEWAY}/api/premium/\${SERVICE}\`;

// 1) First call → server asks for payment (HTTP 402)
const first = await fetch(endpoint);
console.log("First call:", first.status);     // 402

// 2) Sign a USDC payment, then retry with the payment headers.
//    (Live mode: use the Circle Gateway client to sign EIP-3009.)
const { GatewayClient } = await import("@circle-fin/x402-batching/client");
const gateway = new GatewayClient({ chain: "arcTestnet", privateKey: process.env.BUYER_PRIVATE_KEY });
await gateway.deposit("0.10");                // fund the gateway once
const { data } = await gateway.pay(endpoint); // pays + retries automatically

console.log("Got data:", data);               // 200 OK + your data`;

  const liveLoop = `// Discover the whole catalog, then buy within a budget.
const catalog = await fetch("${base}/api/agent").then(r => r.json());
let spent = 0, budget = 0.10;
for (const s of catalog.services) {
  if (spent + Number(s.price.amount) > budget) continue;
  const { data } = await gateway.pay(s.url);  // x402 handled for you
  console.log(s.name, "→", data);
  spent += Number(s.price.amount);
}`;

  const endpointExample = `// A valid x402 endpoint, in any framework. Called WITHOUT payment it must
// return 402 with this JSON challenge; once paid, return your data (200).
// Example: Next.js route / Express handler / any HTTP server.

export async function GET(req) {
  const payment = req.headers.get("x-payment");

  // 1) No payment yet → reply 402 with the challenge AuraGate health-checks.
  if (!payment) {
    return Response.json({
      x402Version: 2,
      accepts: [{
        scheme: "exact",
        network: "eip155:5042002",              // Arc testnet
        asset: "0x<USDC-contract-on-Arc>",      // USDC on Arc
        amount: "2000",                          // atomic USDC (6 dp) → $0.002
        payTo: "0xYourWalletAddress",            // where the USDC lands
        maxTimeoutSeconds: 60
      }],
      error: "Payment required"
    }, { status: 402 });
  }

  // 2) Payment present → verify+settle, then return your data.
  return Response.json({ city: "Hanoi", temperatureC: 31 });
}`;

  const probeCurl = `# Check your endpoint is x402-compliant BEFORE listing it.
curl -X POST ${base}/api/services/probe \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://my-api.com/x402/weather", "method": "GET", "price": "0.002" }'
# → { "ok": true, "summary": "Valid x402 endpoint ✓", "checks": [ … ] }`;

  const registerCurl = `curl -X POST ${base}/api/services \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Weather API",
    "description": "Live weather for any city, pay-per-call.",
    "category": "data",
    "price": "0.002",
    "method": "GET",
    "sellerName": "MyCompany",
    "sellerAddress": "0xYourWalletAddress",
    "externalUrl": "https://my-api.com/x402/weather",
    "docsUrl": "https://my-api.com/docs",
    "tags": ["weather", "realtime"],
    "sampleResponse": { "city": "Hanoi", "temperatureC": 31 }
  }'`;

  return (
    <div className="container-page py-10">
      {/* Header */}
      <div className="max-w-3xl">
        <span className="badge">Documentation</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">How AuraGate works</h1>
        <p className="mt-3 text-muted">
          AuraGate is an open marketplace where <strong className="text-ink">AI agents pay
          for APIs with USDC</strong>, a few cents per request, using the open{" "}
          <a href="https://www.x402.org" target="_blank" rel="noreferrer" className="text-primary hover:underline">x402</a>{" "}
          standard on Arc. No sign-up, no API keys, no subscriptions. This page shows
          both sides: how to <strong className="text-ink">buy</strong> an API as an agent,
          and how to <strong className="text-ink">list</strong> your own API as a seller.
        </p>
      </div>

      {/* Quick nav */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          ["#buy", "🤖 Buy an API (agents)"],
          ["#list", "🏷️ List an API (sellers)"],
          ["#flow", "🔄 The x402 flow"],
          ["#catalog", "📚 All services"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="badge hover:!text-ink">{label}</a>
        ))}
      </div>

      {/* The x402 flow */}
      <Section id="flow" title="🔄 The x402 payment flow" subtitle="What happens on every purchase — in four steps.">
        <ol className="grid gap-3 sm:grid-cols-2">
          {[
            ["1. Ask", "Agent calls the service URL. The server replies 402 Payment Required with the price, recipient and network."],
            ["2. Pay", "Agent signs a USDC authorization (EIP-3009) for the exact amount and retries with an X-PAYMENT header."],
            ["3. Settle", "AuraGate verifies and settles the USDC through Circle Gateway in under a second — no gas fees."],
            ["4. Receive", "Agent gets the data plus an on-chain receipt (x-receipt-id, x-result-hash, x-settlement-tx)."],
          ].map(([t, d]) => (
            <li key={t} className="card p-4">
              <p className="font-semibold text-primary">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Buy an API */}
      <Section id="buy" title="🤖 Buy an API (for agents & developers)" subtitle="Three ways, from quickest to production.">
        <h3 className="mt-2 font-semibold">Option A — Try it in the browser (no code)</h3>
        <p className="mt-1 text-sm text-muted">
          Open any service in the <Link href="/services" className="text-primary hover:underline">Marketplace</Link>,
          click <strong className="text-ink">“Try it now”</strong>, and watch the full 402 → pay → data
          flow. It uses a demo wallet, so it&apos;s free and needs no login.
        </p>

        <h3 className="mt-6 font-semibold">Option B — Raw HTTP (curl)</h3>
        <p className="mt-1 text-sm text-muted">Any language that speaks HTTP can buy. The pattern is always: call, get 402, pay, retry.</p>
        <Code code={curl} label="curl" />

        <h3 className="mt-6 font-semibold">Option C — A real agent (Node.js + Circle Gateway)</h3>
        <p className="mt-1 text-sm text-muted">
          The Circle Gateway client signs the USDC payment and retries for you. Set{" "}
          <code className="text-ink">BUYER_PRIVATE_KEY</code> (a testnet wallet with USDC).
        </p>
        <Code code={jsAgent} label="my-agent.mjs" />

        <h3 className="mt-6 font-semibold">Discover everything, then buy within a budget</h3>
        <p className="mt-1 text-sm text-muted">
          The machine-readable catalog lives at{" "}
          <a href="/api/agent" target="_blank" rel="noreferrer" className="text-primary hover:underline">/api/agent</a>.
          An agent reads it, then pays for what it needs under a spending cap.
        </p>
        <Code code={liveLoop} label="budget loop" />
        <p className="mt-3 text-sm text-muted">
          Prefer a ready-made script? The repo ships{" "}
          <code className="text-ink">npm run agent</code> (buys the whole catalog) and{" "}
          <code className="text-ink">npm run demo:crypto</code> (buys one service).
        </p>
      </Section>

      {/* List an API */}
      <Section id="list" title="🏷️ List an API (for sellers)" subtitle="Anyone can list — no application, no waitlist.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["1. Host an x402 endpoint", "Your endpoint returns 402 with a payment challenge, then your data once paid. Or list a demo hosted on AuraGate."],
            ["2. Register it", "Submit it from the dashboard form, or POST to /api/services. AuraGate health-checks the 402 to verify it."],
            ["3. Get paid", "USDC lands in your wallet the moment an agent calls it. Your reputation grows from real, rated usage."],
          ].map(([t, d]) => (
            <div key={t} className="card p-4">
              <p className="font-semibold text-primary">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 font-semibold">What makes a valid x402 endpoint?</h3>
        <p className="mt-1 text-sm text-muted">
          When called <strong className="text-ink">without payment</strong>, your URL must
          reply <code className="text-ink">402</code> with a JSON challenge whose{" "}
          <code className="text-ink">accepts</code> array says how to pay —{" "}
          <code className="text-ink">amount</code> (atomic USDC),{" "}
          <code className="text-ink">payTo</code> (your wallet), plus{" "}
          <code className="text-ink">scheme</code>/<code className="text-ink">network</code>/
          <code className="text-ink">asset</code>. After the buyer pays, return your data with{" "}
          <code className="text-ink">200</code>. AuraGate health-checks exactly this at registration.
        </p>
        <Code code={endpointExample} label="x402 endpoint" />

        <h3 className="mt-6 font-semibold">Test before you list</h3>
        <p className="mt-1 text-sm text-muted">
          Use the <strong className="text-ink">Test endpoint</strong> button on the{" "}
          <Link href="/dashboard" className="text-primary hover:underline">dashboard</Link>, or POST to{" "}
          <code className="text-ink">/api/services/probe</code>. You get a checklist of exactly
          what passes and what to fix — no guessing.
        </p>
        <Code code={probeCurl} label="test endpoint" />

        <h3 className="mt-6 font-semibold">Option A — The dashboard form (easiest)</h3>
        <p className="mt-1 text-sm text-muted">
          Go to the <Link href="/dashboard" className="text-primary hover:underline">Seller dashboard</Link>,
          fill in the “List a service” form, click <strong className="text-ink">Test endpoint</strong> to
          verify your URL, then submit. Leave the URL blank to get a free hosted demo endpoint instead.
        </p>

        <h3 className="mt-6 font-semibold">Option B — Register via API</h3>
        <p className="mt-1 text-sm text-muted">POST your service definition to <code className="text-ink">/api/services</code>:</p>
        <Code code={registerCurl} label="register" />

        <div className="card mt-4 p-4 text-sm text-muted">
          <p className="font-semibold text-ink">Field reference</p>
          <ul className="mt-2 space-y-1">
            <li><code className="text-ink">price</code> — USDC per request, as a string (e.g. <code className="text-ink">&quot;0.002&quot;</code>).</li>
            <li><code className="text-ink">sellerAddress</code> — the wallet that receives USDC.</li>
            <li><code className="text-ink">externalUrl</code> — your own x402 endpoint (omit to host a demo on AuraGate).</li>
            <li><code className="text-ink">method</code> — <code className="text-ink">GET</code> or <code className="text-ink">POST</code>.</li>
            <li><code className="text-ink">tags</code>, <code className="text-ink">docsUrl</code>, <code className="text-ink">sampleResponse</code> — shown on your service page.</li>
          </ul>
        </div>
      </Section>

      {/* Catalog */}
      <Section id="catalog" title={`📚 All ${services.length} services`} subtitle="Every service is live data from a real source. Click to view & try.">
        <div className="mt-2 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel2/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Seller</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Method</th>
                <th className="px-4 py-2.5 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.slug} className="border-t border-line/60 hover:bg-panel/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/services/${s.slug}`} className="font-medium hover:text-primary">{s.name}</Link>
                    <p className="text-xs text-muted">/api/premium/{s.slug}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{s.sellerName}</td>
                  <td className="hidden px-4 py-2.5 sm:table-cell"><span className="badge">{s.method}</span></td>
                  <td className="px-4 py-2.5 text-right font-semibold text-mint">{usd(s.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          Machine-readable version at{" "}
          <a href="/api/agent" target="_blank" rel="noreferrer" className="text-primary hover:underline">/api/agent</a>.
        </p>
      </Section>
    </div>
  );
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-20">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
