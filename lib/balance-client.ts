"use client";

import { createPublicClient, http, formatUnits } from "viem";
import { ARC } from "./arc";

/**
 * Browser-side USDC balance reader. Runs in the user's browser (not on Vercel's
 * serverless network, which can't always reach the Arc testnet RPC), so the
 * live balance shows up reliably for whoever is connected.
 */

const arcChain = {
  id: ARC.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [ARC.rpcUrl] } },
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
const ZERO = "0x0000000000000000000000000000000000000000";

export interface ClientBalance {
  usdc: string;
  configured: boolean;
  rpcError?: boolean;
}

export async function readUsdcBalanceClient(address: string): Promise<ClientBalance> {
  const usdc = ARC.usdcAddress;
  if (!ETH_ADDR.test(address)) return { usdc: "0", configured: false };
  if (!ETH_ADDR.test(usdc) || usdc === ZERO) return { usdc: "0", configured: false };

  try {
    const client = createPublicClient({
      chain: arcChain,
      transport: http(ARC.rpcUrl, { timeout: 10_000 }),
    });
    let decimals = 6;
    try {
      decimals = Number(
        await client.readContract({
          address: usdc as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "decimals",
        })
      );
    } catch {
      /* default to 6 */
    }
    const raw = (await client.readContract({
      address: usdc as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;
    return { usdc: formatUnits(raw, decimals), configured: true };
  } catch {
    return { usdc: "0", configured: true, rpcError: true };
  }
}
