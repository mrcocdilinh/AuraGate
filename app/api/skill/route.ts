import { NextRequest, NextResponse } from "next/server";
import { listServices } from "@/lib/store";
import { ARC } from "@/lib/arc";
import { toAtomicUSDC } from "@/lib/x402";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * Circle Skill manifest endpoint.
 * Format: circlefin/skills convention.
 * Discovered by Circle CLI via `circle services search` and Circle Agent Marketplace.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const services = await listServices();
  const active = services.filter((s) => s.active);

  const capabilities = active.map((s) => ({
    id: s.slug,
    name: s.name,
    description: s.description,
    method: s.method,
    endpoint: s.externalUrl ?? `${origin}${s.endpoint}`,
    category: s.category,
    ...(s.tags?.length ? { tags: s.tags } : {}),
    ...(s.docsUrl ? { documentation: s.docsUrl } : {}),
    payment: {
      protocol: "x402",
      version: 2,
      network: ARC.caip2,
      asset: ARC.usdcAddress,
      amount: toAtomicUSDC(s.price),
      amountUsd: s.price,
      currency: "USDC",
      payTo: /^0x[0-9a-fA-F]{40}$/.test(s.sellerAddress)
        ? s.sellerAddress
        : (process.env.SELLER_ADDRESS ?? ""),
      settlement: "circle-gateway",
      facilitator:
        process.env.GATEWAY_FACILITATOR_URL ??
        "https://gateway-api-testnet.circle.com",
    },
    outputSchema: {
      type: "object",
      description: `Response from ${s.name}`,
      example: s.sampleResponse,
    },
  }));

  return withCors(
    NextResponse.json(
      {
        schema: "circlefin/skill@1.0",
        name: "AuraGate",
        version: "1.0.0",
        description:
          "Open, permissionless x402 services registry on Arc. Discover and pay for AI data, oracle, and analytics APIs using USDC nanopayments — no API key, no subscription.",
        publisher: {
          name: "AuraGate",
          url: origin,
          email: "contact@auragate.app",
        },
        registry: {
          open: true,
          discovery: `${origin}/.well-known/x402.json`,
          catalog: `${origin}/api/agent`,
          register: `${origin}/api/services`,
        },
        network: {
          name: ARC.mode === "mainnet" ? "Arc Mainnet" : "Arc Testnet",
          chainId: ARC.chainId,
          caip2: ARC.caip2,
          explorer: ARC.explorer,
        },
        paymentProtocol: {
          name: "x402",
          version: 2,
          flow: [
            "1. GET/POST the capability endpoint",
            "2. Receive 402 with accepts[] — amount, payTo, network",
            "3. Sign EIP-3009 TransferWithAuthorization off-chain",
            "4. Retry with X-PAYMENT header",
            "5. Receive 200 + x-receipt-id (on-chain receipt)",
          ],
          receiptRegistry: ARC.receiptRegistry,
        },
        capabilities,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    )
  );
}
