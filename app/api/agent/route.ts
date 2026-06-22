import { NextRequest, NextResponse } from "next/server";
import { listServices } from "@/lib/store";
import { ARC } from "@/lib/arc";
import { toAtomicUSDC, x402Info } from "@/lib/x402";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const services = (await listServices()).map((s) => ({
    id: s.slug,
    name: s.name,
    description: s.description,
    category: s.category,
    seller: s.sellerName,
    sellerAddress: s.sellerAddress,
    method: s.method,
    // Seller-hosted endpoints are advertised directly; internal demos proxy.
    url: s.externalUrl ?? `${origin}${s.endpoint}`,
    hosted: s.externalUrl ? "seller" : "auragate",
    verified: Boolean(s.verified),
    ...(s.tags?.length ? { tags: s.tags } : {}),
    ...(s.docsUrl ? { docs: s.docsUrl } : {}),
    price: { amount: s.price, currency: "USDC", atomic: toAtomicUSDC(s.price) },
  }));

  return withCors(NextResponse.json({
    name: "AuraGate",
    description:
      "Open, permissionless registry of x402 services on Arc with on-chain receipts and reputation. Pay USDC per request via x402 + Circle Gateway.",
    registry: {
      open: true,
      register: `${origin}/api/services`,
      sellers: `${origin}/api/sellers`,
      receipts: `${origin}/api/receipts`,
      discovery: `${origin}/.well-known/x402.json`,
      skill: `${origin}/api/skill`,
    },
    protocol: { name: "x402", version: 2, settlement: "circle-gateway", batching: true },
    network: {
      name: ARC.mode === "mainnet" ? "Arc Mainnet" : "Arc Testnet",
      chainId: ARC.chainId,
      caip2: ARC.caip2,
      mode: ARC.mode,
      asset: "USDC",
      assetAddress: ARC.usdcAddress,
      explorer: ARC.explorer,
      receiptRegistry: ARC.receiptRegistry,
      receiptRegistryVersion: ARC.receiptRegistryVersion,
    },
    payment: {
      mode: x402Info.mode,
      facilitator: x402Info.facilitatorUrl,
      instructions:
        "Request the service URL. On 402, sign the X-PAYMENT authorization (EIP-3009) for the advertised amount and retry. A signed receipt is returned in the x-receipt-id header.",
    },
    services,
  }));
}
