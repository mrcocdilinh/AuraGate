/**
 * Authorize (or revoke) a recorder on ReceiptRegistryV2.
 *
 * Only the contract OWNER can do this. Signs with DEPLOYER_PRIVATE_KEY
 * (which must be the owner key — currently the 0xB52D wallet).
 *
 *   node scripts/set_recorder.cjs 0xNewRecorder        # authorize
 *   node scripts/set_recorder.cjs --revoke 0xOldRecorder
 *
 * After authorizing the new recorder, set DEPLOYER_PRIVATE_KEY on Vercel to
 * the NEW recorder's key so the app records receipts from that wallet.
 */
require("dotenv").config({ path: ".env.local" });

const { createWalletClient, createPublicClient, http, getAddress } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

const ABI = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "recorders", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "setRecorder", type: "function", stateMutability: "nonpayable", inputs: [{ name: "recorder", type: "address" }, { name: "allowed", type: "bool" }], outputs: [] },
];

const arcTestnet = {
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002),
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network"] } },
};

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  const registry = process.env.NEXT_PUBLIC_RECEIPT_REGISTRY;
  if (!pk || /^0x0+$/.test(pk)) return fail("Missing DEPLOYER_PRIVATE_KEY (must be the OWNER key) in .env.local");
  if (!registry || !/^0x[0-9a-fA-F]{40}$/.test(registry)) return fail("Missing/invalid NEXT_PUBLIC_RECEIPT_REGISTRY in .env.local");

  const revoke = process.argv.includes("--revoke");
  const target = process.argv.find((a) => /^0x[0-9a-fA-F]{40}$/.test(a));
  if (!target) return fail("Provide a recorder address: node scripts/set_recorder.cjs 0xNewRecorder [--revoke]");
  const recorder = getAddress(target);
  const allowed = !revoke;

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  const owner = await publicClient.readContract({ address: registry, abi: ABI, functionName: "owner" });
  console.log("Registry:", registry);
  console.log("Owner:   ", owner);
  console.log("Caller:  ", account.address, account.address.toLowerCase() === owner.toLowerCase() ? "(= owner ✓)" : "(NOT owner ✗)");
  if (account.address.toLowerCase() !== owner.toLowerCase()) {
    return fail("DEPLOYER_PRIVATE_KEY is not the contract owner — only the owner can set recorders.");
  }

  const before = await publicClient.readContract({ address: registry, abi: ABI, functionName: "recorders", args: [recorder] });
  console.log(`\n${recorder} is recorder: ${before} → setting to ${allowed}…`);

  const hash = await walletClient.writeContract({ address: registry, abi: ABI, functionName: "setRecorder", args: [recorder, allowed] });
  console.log("Tx:", hash, "— waiting…");
  await publicClient.waitForTransactionReceipt({ hash });

  const after = await publicClient.readContract({ address: registry, abi: ABI, functionName: "recorders", args: [recorder] });
  console.log(`Done. ${recorder} is recorder: ${after}`);
  if (allowed) {
    console.log("\nNext: set DEPLOYER_PRIVATE_KEY on Vercel to THIS recorder's key, then redeploy.");
  }
}

function fail(msg) {
  console.error("✗", msg);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
