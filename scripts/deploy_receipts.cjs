const hre = require("hardhat");

async function main() {
  const Factory = await hre.ethers.getContractFactory("ReceiptRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log("ReceiptRegistry deployed to:", addr);
  console.log("Set NEXT_PUBLIC_RECEIPT_REGISTRY=" + addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});