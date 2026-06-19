import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  encodePacked,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC } from "./arc";

const arcChain = {
  id: ARC.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [ARC.rpcUrl] } },
} as const;

const REGISTRY_ABI = [
  {
    name: "recordReceipt",
    type: "function",
    inputs: [
      { name: "payer", type: "address" },
      { name: "serviceId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "resultHash", type: "bytes32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

const ETH_ADDR = /^0x[0-9a-fA-F]{40}$/;

/**
 * Write a receipt to ReceiptRegistry on Arc Testnet.
 * Returns the tx hash, or null if not configured or payer is a demo address.
 */
export async function writeReceiptOnChain(params: {
  payer: string;
  serviceSlug: string;
  amountUsd: string;
  resultHash: string;
}): Promise<string | null> {
  const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  const registry = ARC.receiptRegistry as `0x${string}`;

  if (!pk || !ETH_ADDR.test(registry) || registry === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  if (!ETH_ADDR.test(params.payer)) {
    // demo/mock payer address — skip on-chain write
    return null;
  }

  try {
    const account = privateKeyToAccount(pk);
    const transport = http(ARC.rpcUrl);
    const walletClient = createWalletClient({ account, chain: arcChain, transport });
    const publicClient = createPublicClient({ chain: arcChain, transport });

    const atomicAmount = BigInt(Math.round(Number(params.amountUsd) * 1_000_000));
    const serviceId = keccak256(encodePacked(["string"], [params.serviceSlug]));

    const txHash = await walletClient.writeContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: "recordReceipt",
      args: [
        params.payer as `0x${string}`,
        serviceId,
        atomicAmount,
        params.resultHash as `0x${string}`,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (e) {
    console.error("[onchain] receipt write failed:", e);
    return null;
  }
}
