const env = (key: string, fallback: string) =>
  (process.env[key] ?? fallback).trim();

const chainIdRaw = env("NEXT_PUBLIC_ARC_CHAIN_ID", "5042002");

export const ARC = {
  chainId: Number(chainIdRaw),
  caip2: `eip155:${chainIdRaw}`,
  rpcUrl: env("NEXT_PUBLIC_ARC_RPC_URL", "https://rpc.testnet.arc.network"),
  explorer: env("NEXT_PUBLIC_ARC_EXPLORER", "https://testnet.arcscan.app"),
  usdcAddress: env(
    "NEXT_PUBLIC_USDC_ADDRESS",
    "0x3600000000000000000000000000000000000000"
  ),
  receiptRegistry: env(
    "NEXT_PUBLIC_RECEIPT_REGISTRY",
    "0x0000000000000000000000000000000000000000"
  ),
  receiptRegistryVersion: env("NEXT_PUBLIC_RECEIPT_REGISTRY_VERSION", "1"),
  mode: env("NEXT_PUBLIC_NETWORK_MODE", "testnet").toLowerCase(),
} as const;

export function explorerTx(hash: string): string {
  return `${ARC.explorer}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${ARC.explorer}/address/${addr}`;
}
