import { createPublicClient, http, formatUnits } from "viem";
import { ARC } from "./arc";

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

export interface BalanceResult {
  address: string;
  /** Human-readable USDC, e.g. "1.234567". */
  usdc: string;
  /** Raw atomic amount as a string. */
  raw: string;
  /** False when USDC contract isn't configured (can't read real balance). */
  configured: boolean;
}

/**
 * Read an address's on-chain USDC balance from Arc. Read-only (no auth, no
 * key) — works for any address, Circle wallet or otherwise. Returns a zeroed
 * result with `configured: false` when the USDC contract address isn't set,
 * so callers can show "—" instead of a misleading $0.00.
 */
export async function getUsdcBalance(address: string): Promise<BalanceResult> {
  const usdc = ARC.usdcAddress;
  const base: BalanceResult = { address, usdc: "0", raw: "0", configured: false };

  if (!ETH_ADDR.test(address)) return base;
  if (!ETH_ADDR.test(usdc) || usdc === ZERO) return base;

  try {
    const client = createPublicClient({ chain: arcChain, transport: http(ARC.rpcUrl) });
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
      /* default to 6 if the token doesn't expose decimals */
    }
    const raw = (await client.readContract({
      address: usdc as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;

    return {
      address,
      usdc: formatUnits(raw, decimals),
      raw: raw.toString(),
      configured: true,
    };
  } catch {
    return base;
  }
}
