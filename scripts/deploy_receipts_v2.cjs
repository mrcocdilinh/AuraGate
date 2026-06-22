/**
 * Deploy ReceiptRegistryV2 using viem.
 * Run: npm run deploy:receipts:v2
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk || /^0x0+$/.test(pk)) {
    console.error("Missing DEPLOYER_PRIVATE_KEY");
    process.exit(1);
  }

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/ReceiptRegistryV2.sol/ReceiptRegistryV2.json"
  );
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found. Run: npm run compile");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const { createWalletClient, createPublicClient, http } = require("viem");
  const { privateKeyToAccount } = require("viem/accounts");

  const chainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002);
  const rpcUrl = (process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network").trim();
  const chain = {
    id: chainId,
    name: process.env.NEXT_PUBLIC_NETWORK_MODE === "mainnet" ? "Arc" : "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  const initialRecorder = process.env.RECEIPT_RECORDER_ADDRESS || account.address;
  console.log("Deploying ReceiptRegistryV2 from:", account.address);
  console.log("Initial recorder:", initialRecorder);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [initialRecorder],
  });

  console.log("Deploy tx:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const addr = receipt.contractAddress;

  console.log("\nReceiptRegistryV2 deployed to:", addr);
  console.log("\nAdd to environment:");
  console.log("NEXT_PUBLIC_RECEIPT_REGISTRY=" + addr);
  console.log("NEXT_PUBLIC_RECEIPT_REGISTRY_VERSION=2");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
