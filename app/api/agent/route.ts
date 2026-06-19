import { NextRequest, NextResponse } from "next/server";
import { listServices } from "@/lib/store";
import { ARC } from "@/lib/arc";
import { toAtomicUSDC, x402Info } from "@/lib/x402";

export const dynamic = "force-dynamic";

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

  return NextResponse.json({
    name: "AuraGate",
    description:
      "Open, permissionless registry of x402 services on Arc with on-chain receipts and reputation. Pay USDC per request via x402 + Circle Gateway.",
    registry: {
      open: true,
      register: `${origin}/api/services`,
      sellers: `${origin}/api/sellers`,
      receipts: `${origin}/api/receipts`,
    },
    protocol: { name: "x402", version: 2, settlement: "circle-gateway" },
    network: {
      name: "Arc Testnet",
      chainId: ARC.chainId,
      caip2: ARC.caip2,
      asset: "USDC",
      assetAddress: ARC.usdcAddress,
      explorer: ARC.explorer,
    },
    payment: {
      mode: x402Info.mode,
      facilitator: x402Info.facilitatorUrl,
      instructions:
        "Request the service URL. On 402, sign the X-PAYMENT authorization (EIP-3009) for the advertised amount and retry. A signed receipt is returned in the x-receipt-id header.",
    },
    services,
  });
}
