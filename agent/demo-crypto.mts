/**
 * AuraGate demo agent — buys ONE service: the crypto price oracle.
 *
 * A minimal, readable walkthrough of the x402 buy flow for a single API:
 *   npm run demo:crypto
 *
 * Set AGENT_TARGET_URL to your Vercel URL to test production, e.g.
 *   AGENT_TARGET_URL=https://auragate.app npm run demo:crypto
 *
 * Uses the demo payer address recognised by the server, so it works without
 * a wallet or private key — no real USDC moves. To do a *real* on-chain
 * payment, use `npm run agent` with X402_MODE=live + BUYER_PRIVATE_KEY.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TARGET = process.env.AGENT_TARGET_URL ?? "http://localhost:3000";
const SERVICE = "oracle-check"; // the crypto price service
const DEMO_AGENT = "0xDemoAgent0000000000000000000000000000001";
const URL = `${TARGET}/api/premium/${SERVICE}`;
const UA = { "user-agent": "AuraGate-Demo-Agent/1.0" };

// Tiny helpers to keep the console output readable.
const line = () => console.log("─".repeat(56));
const j = (o: unknown) => JSON.stringify(o, null, 2);

async function main() {
  console.log("\n🤖 AuraGate demo agent — buying a crypto price check\n");
  console.log(`   Target : ${TARGET}`);
  console.log(`   Service: ${SERVICE}`);
  console.log(`   Payer  : ${DEMO_AGENT} (demo — no real USDC)\n`);
  line();

  // ── Step 1: ask for the data without paying ───────────────────────────────
  console.log("\n① Agent asks for the price (no payment yet)…\n");
  const r1 = await fetch(URL, { headers: { ...UA } });
  const challenge = await r1.json().catch(() => ({}));
  if (r1.status !== 402) {
    console.log(`   ✗ Expected HTTP 402 but got ${r1.status}.`);
    console.log("   → Check AGENT_TARGET_URL points at your live AuraGate URL,");
    console.log("     and that the deployment isn't behind login/bot protection.\n");
    process.exit(1);
  }
  console.log(`   ← Server replied: HTTP ${r1.status} (Payment Required)`);
  const accept = challenge?.accepts?.[0];
  if (accept) {
    console.log(`   ← Price asked   : ${Number(accept.amount) / 1e6} USDC`);
    console.log(`   ← Pay to        : ${accept.payTo}`);
    console.log(`   ← Network       : ${accept.network}`);
  }

  // ── Step 2: sign a payment authorization (demo header) ─────────────────────
  console.log("\n② Agent signs a USDC payment and retries…\n");
  const paymentHeader = Buffer.from(
    JSON.stringify({ payer: DEMO_AGENT, ts: Date.now() })
  ).toString("base64");

  const r2 = await fetch(URL, {
    headers: { ...UA, "x-payment": paymentHeader, "x-payer": DEMO_AGENT },
  });

  if (!r2.ok) {
    console.log(`   ✗ Payment failed: HTTP ${r2.status}`);
    console.log(j(await r2.json().catch(() => ({}))));
    process.exit(1);
  }

  // ── Step 3: data + receipt arrive ──────────────────────────────────────────
  const data = await r2.json();
  const receiptId = r2.headers.get("x-receipt-id");
  const resultHash = r2.headers.get("x-result-hash");
  const settlementTx = r2.headers.get("x-settlement-tx");
  const explorer = r2.headers.get("x-arc-explorer");

  console.log(`   ← Server replied: HTTP ${r2.status} ✅ Paid!\n`);
  line();
  console.log("\n③ Agent received the crypto prices:\n");
  console.log(j(data));

  console.log("\n🧾 Proof of purchase:\n");
  console.log(`   Receipt ID : ${receiptId}`);
  console.log(`   Result hash: ${resultHash}`);
  if (settlementTx) {
    console.log(`   On-chain tx: ${settlementTx}`);
    if (explorer) console.log(`   Explorer   : ${explorer}/tx/${settlementTx}`);
  }
  console.log("\n✨ Done — the agent bought live crypto prices in one call.\n");
}

main().catch((e) => {
  console.error("\n✗ Error:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
