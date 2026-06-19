/**
 * AuraGate buyer agent.
 *
 * Reads the AuraGate catalog, pays for services with USDC per request, and
 * (optionally) asks Claude to synthesise a report from what it bought.
 *
 *   npm run agent                 # uses AGENT_TARGET_URL (default localhost)
 *   npm run agent -- --limit 0.05 # spending cap in USDC
 *
 * Mode:
 *  - X402_MODE=mock  → scripted HTTP loop (no Circle Gateway needed)
 *  - X402_MODE=live  → real signing + settlement via Circle GatewayClient
 */
import "dotenv/config";

const TARGET = process.env.AGENT_TARGET_URL ?? "http://localhost:3000";
const MODE = (process.env.X402_MODE ?? "mock").toLowerCase();
const PK = process.env.BUYER_PRIVATE_KEY ?? "";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const LIMIT = Number(arg("limit", "0.10"));

interface CatalogService {
  id: string;
  name: string;
  url: string;
  price: { amount: string };
}

async function getCatalog(): Promise<CatalogService[]> {
  const res = await fetch(`${TARGET}/api/agent`);
  const json = await res.json();
  return json.services ?? [];
}

async function payMock(s: CatalogService): Promise<unknown> {
  // 1) expect 402
  const r1 = await fetch(s.url);
  console.log(`  ↳ ${s.name}: ${r1.status} Payment Required`);
  // 2) sign (stub) + retry
  const r2 = await fetch(s.url, {
    headers: {
      "x-payment": Buffer.from(
        JSON.stringify({ price: s.price.amount, payer: "agent-mock" })
      ).toString("base64"),
      "x-payer": "0xA9e7000000000000000000000000000000000Bob",
    },
  });
  console.log(`  ↳ paid $${s.price.amount} → receipt ${r2.headers.get("x-receipt-id")}`);
  return r2.json();
}

async function payLive(s: CatalogService, gateway: any): Promise<unknown> {
  const { data, amount } = await gateway.pay(s.url);
  console.log(`  ↳ paid ${amount} USDC for ${s.name}`);
  return data;
}

async function maybeSummarise(results: Record<string, unknown>) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.log("\n(no ANTHROPIC_API_KEY — skipping Claude summary)");
    return;
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `I bought these API results on AuraGate. Write a 3-bullet report:\n${JSON.stringify(results).slice(0, 4000)}`,
      },
    ],
  });
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  console.log("\n=== Claude report ===\n" + text);
}

async function main() {
  console.log(`AuraGate agent → ${TARGET} (mode: ${MODE}, limit: $${LIMIT})\n`);
  const catalog = await getCatalog();
  console.log(`Discovered ${catalog.length} services.\n`);

  let gateway: any = null;
  if (MODE === "live") {
    if (!PK || /^0x0+$/.test(PK)) throw new Error("BUYER_PRIVATE_KEY required for live mode");
    const { GatewayClient } = await import("@circle-fin/x402-batching/client");
    gateway = new GatewayClient({
      chain: "arcTestnet",
      privateKey: PK as `0x${string}`,
    });
    console.log(`Buyer wallet: ${gateway.address}`);
    await gateway.deposit(String(LIMIT));
    console.log(`Deposited ${LIMIT} USDC into Gateway.\n`);
  }

  const results: Record<string, unknown> = {};
  let spent = 0;
  for (const s of catalog) {
    const price = Number(s.price.amount);
    if (spent + price > LIMIT) {
      console.log(`  ↳ skip ${s.name} (limit reached)`);
      continue;
    }
    results[s.id] = MODE === "live" ? await payLive(s, gateway) : await payMock(s);
    spent += price;
  }

  console.log(`\nTotal spent: $${spent.toFixed(4)} across ${Object.keys(results).length} calls.`);
  await maybeSummarise(results);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});