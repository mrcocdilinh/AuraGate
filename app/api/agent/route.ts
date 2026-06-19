import { NextRequest, NextResponse } from "next/server";
import { listServices } from "@/lib/store";
import { ARC } from "@/lib/arc";
import { toAtomicUSDC, x402Info } from "@/lib/x402";

export const dynamic = "force-dynamic";

/**
 * Machine-readable service catalog for AI agents (x402 discovery / MCP-style).
 * An agent can read this to discover what it can buy, the price and how to pay.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const services = listServices().map((s) => ({
    id: s.slug,
    name: s.name,
    description: s.description,
    category: s.category,
    seller: s.sellerName,
    method: s.method,
    url: `${origin}${s.endpoint}`,
    price: { amount: s.price, currency: "USDC", atomic: toAtomicUSDC(s.price) },
  }));

  return NextResponse.json({
    name: "AuraGate",
    description:
      "Discovery & payment marketplace for the agentic economy on Arc. Pay USDC per request via x402 + Circle Gateway.",
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