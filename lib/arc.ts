export const ARC = {
  chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002),
  caip2: `eip155:${process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002}`,
  rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network",
  explorer: process.env.NEXT_PUBLIC_ARC_EXPLORER || "https://testnet.arcscan.app",
  usdcAddress:
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    "0x3600000000000000000000000000000000000000",
  receiptRegistry:
    process.env.NEXT_PUBLIC_RECEIPT_REGISTRY ||
    "0x0000000000000000000000000000000000000000",
} as const;

export function explorerTx(hash: string): string {
  return `${ARC.explorer}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${ARC.explorer}/address/${addr}`;
}