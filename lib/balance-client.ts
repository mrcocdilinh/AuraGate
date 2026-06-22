"use client";

import { createPublicClient, http, formatUnits } from "viem";

/**
 * Browser-side USDC balance reader. Runs in the user's browser → Arc RPC.
 * Vercel's serverless network can't reliably reach Arc testnet RPC, but the
 * user's browser can, so we do the call here.
 *
 * Addresses are hardcoded so this works even when env vars are missing/empty.
 */

// Arc Testnet constants — hardcoded so env vars can't break this.
const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 5042002;
const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";
const ARC_USDC =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS || "").replace(/\s/g, "") ||
  "0x3600000000000000000000000000000000000000";

const arcChain = {
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const ETH_ADDR = /^0x[0-9a-fA-F]{40}$/;

export interface ClientBalance {
  usdc: string;
  configured: boolean;
  rpcError?: boolean;
}

export async function readUsdcBalanceClient(address: string): Promise<ClientBalance> {
  if (!ETH_ADDR.test(address)) return { usdc: "0", configured: false };
  if (!ETH_ADDR.test(ARC_USDC)) return { usdc: "0", configured: false };

  try {
    const client = createPublicClient({
      chain: arcChain,
      transport: http(ARC_RPC, { timeout: 12_000 }),
    });
    let decimals = 6;
    try {
      decimals = Number(
        await client.readContract({
          address: ARC_USDC as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "decimals",
        })
      );
    } catch {
      /* default to 6 */
    }
    const raw = (await client.readContract({
      address: ARC_USDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;
    return { usdc: formatUnits(raw, decimals), configured: true };
  } catch {
    return { usdc: "0", configured: true, rpcError: true };
  }
}
