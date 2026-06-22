/**
 * AuraGate fleet — 5 autonomous buyer agents, each specialised in a different
 * field, each buying several APIs to exercise the full x402 flow end-to-end.
 *
 *   npm run fleet                      # mock mode (no funds) against AGENT_TARGET_URL
 *   X402_MODE=live npm run fleet       # real USDC via Circle Gateway (needs funded keys)
 *
 * Keys are read from .env.agents.local (gitignored): AGENT1_KEY … AGENT5_KEY.
 * Each agent's wallet address is derived from its key and used as the on-chain
 * buyer, so receipts and the dashboard show 5 distinct buyers across categories.
 */
import { config } from "dotenv";
config({ path: ".env.agents.local" });
config({ path: ".env.local" });
config();

import { privateKeyToAccount } from "viem/accounts";

const TARGET = (process.env.AGENT_TARGET_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MODE = (process.env.X402_MODE ?? "mock").toLowerCase();

// ── tiny ANSI colour helpers ────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", gray: "\x1b[90m",
};
const col = (c: keyof typeof C, s: string) => `${C[c]}${s}${C.reset}`;

interface AgentDef {
  n: number; name: string; emoji: string; field: string;
  slugs: string[]; limit: number; color: keyof typeof C;
}

// 5 agents → 5 fields. Each buys several small services in its field.
const FLEET: AgentDef[] = [
  { n: 1, name: "CryptoQuant", emoji: "🪙", field: "Crypto markets", color: "yellow",
    slugs: ["oracle-check", "price-multi-exchange", "global-crypto", "sentiment", "mempool"], limit: 0.05 },
  { n: 2, name: "WallStreet", emoji: "📈", field: "Stocks · metals · FX", color: "green",
    slugs: ["stocks", "metals", "fx-rates", "fx-convert"], limit: 0.05 },
  { n: 3, name: "GeoScout", emoji: "🌍", field: "Weather · geo · world", color: "cyan",
    slugs: ["weather", "forecast", "air-quality", "country-info", "timezone"], limit: 0.05 },
  { n: 4, name: "Scholar", emoji: "📚", field: "Knowledge · research", color: "magenta",
    slugs: ["wikipedia", "dictionary", "quote", "holidays"], limit: 0.04 },
  { n: 5, name: "DevPulse", emoji: "💻", field: "Dev · tech · DeFi", color: "blue",
    slugs: ["news-tech", "npm-stats", "github-repo", "defi-tvl", "summarize"], limit: 0.06 },
];

interface CatalogService {
  id: string; name: string; url: string; method: "GET" | "POST"; price: { amount: string };
}

const SUMMARY_TEXT =
  "AuraGate is a permissionless marketplace where AI agents pay USDC per request " +
  "using the open x402 protocol on Arc testnet, with on-chain receipts as proof.";

async function getCatalog(): Promise<Map<string, CatalogService>> {
  const res = await fetch(`${TARGET}/api/agent`);
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status} — is the server running at ${TARGET}?`);
  const json = await res.json();
  const map = new Map<string, CatalogService>();
  for (const s of json.services ?? []) map.set(s.id, s);
  return map;
}

function preview(data: unknown, len = 120): string {
  const s = JSON.stringify(data);
  return s.length > len ? s.slice(0, len) + "…" : s;
}

/** Buy one service, printing the full request → 402 → pay → data → receipt flow. */
async function buyOne(
  agent: AgentDef, address: string, svc: CatalogService, gateway: any
): Promise<{ paid: number; ok: boolean }> {
  const tag = col(agent.color, `  [${agent.name}]`);
  const isPost = svc.method === "POST";
  const price = Number(svc.price.amount);

  // ── Step 1: call without paying → expect 402 ──────────────────────────────
  const r1 = await fetch(svc.url, {
    method: svc.method,
    headers: isPost ? { "content-type": "application/json" } : {},
    ...(isPost ? { body: JSON.stringify({ text: SUMMARY_TEXT }) } : {}),
  });
  let challenge: any = null;
  try { challenge = await r1.clone().json(); } catch { /* ignore */ }
  const accept = challenge?.accepts?.[0];
  console.log(`${tag} ${col("bold", svc.name)} ${col("gray", `(${svc.method})`)}`);
  console.log(`${tag}   ① GET ${svc.url.replace(TARGET, "")} → ${col("yellow", `${r1.status} Payment Required`)}`);
  if (accept) {
    console.log(`${tag}      ${col("gray", `challenge: pay ${col("reset", "$" + price)}${C.gray} to ${accept.payTo?.slice(0, 10)}… on ${accept.network}`)}`);
  }

  if (r1.status !== 402) {
    console.log(`${tag}   ${col("red", `✗ expected 402, got ${r1.status} — skipping`)}`);
    return { paid: 0, ok: false };
  }

  // ── Step 2: pay + retry ───────────────────────────────────────────────────
  let data: unknown; let receiptId: string | null = null; let txInfo = "";
  try {
    if (MODE === "live") {
      const opts = isPost
        ? { method: "POST", body: JSON.stringify({ text: SUMMARY_TEXT }), headers: { "content-type": "application/json" } }
        : undefined;
      const res = await gateway.pay(svc.url, opts);
      data = res.data;
      txInfo = res.amount ? ` (${res.amount} USDC)` : "";
      console.log(`${tag}   ② signed EIP-3009 + settled via Circle Gateway${txInfo}`);
    } else {
      const header = Buffer.from(JSON.stringify({ price: svc.price.amount, payer: address, ts: Date.now() })).toString("base64");
      const r2 = await fetch(svc.url, {
        method: svc.method,
        headers: {
          "x-payment": header,
          "x-payer": address,
          ...(isPost ? { "content-type": "application/json" } : {}),
        },
        ...(isPost ? { body: JSON.stringify({ text: SUMMARY_TEXT }) } : {}),
      });
      if (!r2.ok) {
        console.log(`${tag}   ${col("red", `✗ payment failed (${r2.status})`)}`);
        return { paid: 0, ok: false };
      }
      receiptId = r2.headers.get("x-receipt-id");
      data = await r2.json();
      console.log(`${tag}   ② sent X-PAYMENT (payer ${address.slice(0, 10)}…) → ${col("green", "200 OK")}`);
    }
  } catch (e) {
    console.log(`${tag}   ${col("red", `✗ error: ${e instanceof Error ? e.message : String(e)}`)}`);
    return { paid: 0, ok: false };
  }

  // ── Step 3: data + receipt ────────────────────────────────────────────────
  console.log(`${tag}   ③ ${col("green", `paid $${price}`)} → receipt ${col("cyan", (receiptId ?? "live-tx").slice(0, 12))}…`);
  console.log(`${tag}      ${col("dim", "data: " + preview(data))}`);
  return { paid: price, ok: true };
}

async function runAgent(agent: AgentDef, catalog: Map<string, CatalogService>) {
  const key = process.env[`AGENT${agent.n}_KEY`];
  if (!key) {
    console.log(col("red", `\n✗ AGENT${agent.n}_KEY missing in .env.agents.local — skipping ${agent.name}`));
    return { name: agent.name, address: "—", spent: 0, calls: 0 };
  }
  const account = privateKeyToAccount(("0x" + key.replace(/^0x/, "")) as `0x${string}`);
  const address = account.address;

  console.log(col(agent.color, `\n${"━".repeat(64)}`));
  console.log(col(agent.color, `${agent.emoji}  AGENT ${agent.n} · ${agent.name}  —  ${agent.field}`));
  console.log(col("gray", `   wallet ${address} · budget $${agent.limit} · ${agent.slugs.length} services`));
  console.log(col(agent.color, "━".repeat(64)));

  // Live mode: spin up a per-agent Gateway client funded from this key.
  let gateway: any = null;
  if (MODE === "live") {
    const { GatewayClient } = await import("@circle-fin/x402-batching/client");
    gateway = new GatewayClient({ chain: "arcTestnet", privateKey: ("0x" + key.replace(/^0x/, "")) as `0x${string}` });
    console.log(col("gray", `   depositing $${agent.limit} into Gateway (on-chain, ~10-30s)…`));
    try {
      await gateway.deposit(String(agent.limit));
    } catch (e) {
      console.log(col("red", `   ✗ deposit failed: ${e instanceof Error ? e.message : e}. Skipping agent.`));
      return { name: agent.name, address, spent: 0, calls: 0 };
    }
  }

  let spent = 0; let calls = 0;
  for (const slug of agent.slugs) {
    const svc = catalog.get(slug);
    if (!svc) { console.log(col("red", `  [${agent.name}] service "${slug}" not in catalog — skip`)); continue; }
    if (spent + Number(svc.price.amount) > agent.limit) {
      console.log(col("gray", `  [${agent.name}] budget reached — skipping ${slug}`));
      continue;
    }
    const r = await buyOne(agent, address, svc, gateway);
    spent += r.paid; if (r.ok) calls += 1;
  }

  console.log(col(agent.color, `   └─ ${agent.name} done: ${calls} APIs bought · $${spent.toFixed(3)} spent`));
  return { name: agent.name, address, spent, calls };
}

async function main() {
  console.log(col("bold", `\n╔══════════════════════════════════════════════════════════════╗`));
  console.log(col("bold", `║   AuraGate Fleet — 5 agents · 5 fields · full x402 flow        ║`));
  console.log(col("bold", `╚══════════════════════════════════════════════════════════════╝`));
  console.log(col("gray", `Target: ${TARGET}   Mode: ${MODE === "live" ? col("green", "LIVE (real USDC)") : col("yellow", "mock (no funds)")}`));

  const catalog = await getCatalog();
  console.log(col("gray", `Discovered ${catalog.size} services in the marketplace catalog.`));

  const results = [];
  for (const agent of FLEET) {
    results.push(await runAgent(agent, catalog));
  }

  // ── Grand summary ─────────────────────────────────────────────────────────
  const totalSpent = results.reduce((a, r) => a + r.spent, 0);
  const totalCalls = results.reduce((a, r) => a + r.calls, 0);
  console.log(col("bold", `\n${"═".repeat(64)}`));
  console.log(col("bold", "  FLEET SUMMARY"));
  console.log(col("bold", "═".repeat(64)));
  for (const r of results) {
    console.log(`  ${r.name.padEnd(12)} ${col("gray", r.address.slice(0, 12) + "…")}  ${String(r.calls).padStart(2)} APIs  $${r.spent.toFixed(3)}`);
  }
  console.log(col("bold", `  ${"-".repeat(50)}`));
  console.log(col("green", `  TOTAL: ${totalCalls} APIs bought across ${results.length} agents · $${totalSpent.toFixed(3)} USDC`));
  console.log(col("gray", `  → See receipts at ${TARGET}/receipts and buyers at ${TARGET}/dashboard\n`));
}

main().catch((e) => { console.error(col("red", String(e))); process.exit(1); });
