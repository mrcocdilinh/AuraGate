/**
 * Seller Gateway setup.
 *
 * Circle Gateway only authorizes x402 payments to a recipient that is itself a
 * known Gateway account. A brand-new EOA is rejected at verify with
 * `invalidReason: "unauthorized"`. Depositing a small amount from the seller
 * wallet establishes its Gateway presence so it can receive nanopayments.
 *
 *   npm run seller:setup                 # deposits 0.1 USDC (default)
 *   npm run seller:setup -- --amount 0.2 # custom amount
 *
 * Requires in .env.local:
 *   SELLER_PRIVATE_KEY=0x...   (the seller wallet, funded with testnet USDC)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PK = process.env.SELLER_PRIVATE_KEY ?? "";
const AMOUNT = arg("amount", "0.1");

async function main() {
  if (!PK || /^0x0+$/.test(PK)) {
    throw new Error("SELLER_PRIVATE_KEY required in .env.local");
  }

  const { GatewayClient } = await import("@circle-fin/x402-batching/client");
  const gateway = new GatewayClient({
    chain: "arcTestnet",
    privateKey: PK as `0x${string}`,
  });
  console.log(`Seller wallet: ${gateway.address}`);

  try {
    const balances = await gateway.getBalances();
    console.log(
      "Balances:",
      JSON.stringify(balances, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
    );
  } catch (e) {
    console.warn("Could not read balances:", e instanceof Error ? e.message : e);
  }

  console.log(`Depositing ${AMOUNT} USDC into Gateway (on-chain tx, ~10-30s)…`);
  const dep = await gateway.deposit(AMOUNT);
  console.log(
    "Deposit result:",
    JSON.stringify(dep, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
  console.log(
    `\n✅ Seller ${gateway.address} now has a Gateway balance and can receive x402 payments.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
