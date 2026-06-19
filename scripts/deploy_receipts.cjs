/**
 * Deploy ReceiptRegistry using viem (no hardhat-ethers plugin needed).
 * Run: node scripts/deploy_receipts.cjs
 */
require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error("Missing DEPLOYER_PRIVATE_KEY in .env.local");
    process.exit(1);
  }

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/ReceiptRegistry.sol/ReceiptRegistry.json"
  );
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found. Run: npx hardhat compile");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const { createWalletClient, createPublicClient, http } = require("viem");
  const { privateKeyToAccount } = require("viem/accounts");

  const arcTestnet = {
    id: 5042002,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: {
      default: { http: ["https://rpc.testnet.arc.network"] },
    },
  };

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  console.log("Deploying ReceiptRegistry from:", account.address);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  });

  console.log("Deploy tx:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const addr = receipt.contractAddress;

  console.log("\nReceiptRegistry deployed to:", addr);
  console.log("\nAdd to Vercel Environment Variables:");
  console.log("NEXT_PUBLIC_RECEIPT_REGISTRY=" + addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
