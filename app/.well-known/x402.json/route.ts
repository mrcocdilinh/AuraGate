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
 * x402 standard discovery endpoint.
 * Indexable by Circle CLI (`circle services search`), Coinbase x402 Bazaar,
 * and any x402-aware agent scanning /.well-known/x402.json.
 *
 * Spec: https://x402.org/discovery
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const sellerAddress =
    (process.env.SELLER_ADDRESS ?? "").trim() ||
    "0x0000000000000000000000000000000000000000";

  const services = await listServices();
  const activeServices = services.filter((s) => s.active);

  const resources = activeServices.map((s) => {
    const resourceUrl = s.externalUrl ?? `${origin}${s.endpoint}`;
    return {
      resource: resourceUrl,
      description: s.description,
      name: s.name,
      category: s.category,
      ...(s.tags?.length ? { tags: s.tags } : {}),
      ...(s.docsUrl ? { docsUrl: s.docsUrl } : {}),
      verified: Boolean(s.verified),
      accepts: [
        {
          scheme: "exact",
          network: ARC.caip2,
          asset: ARC.usdcAddress,
          amount: toAtomicUSDC(s.price),
          payTo: /^0x[0-9a-fA-F]{40}$/.test(s.sellerAddress)
            ? s.sellerAddress
            : sellerAddress,
          maxTimeoutSeconds: 60,
          extra: { name: "USDC", decimals: 6 },
        },
      ],
      outputSchema: inferOutputSchema(s.sampleResponse),
    };
  });

  return withCors(
    NextResponse.json(
      {
        version: "2.0",
        registry: {
          name: "AuraGate",
          description:
            "Open, permissionless x402 services registry on Arc. Any developer can self-register a paid API endpoint — no approval, no API key required.",
          url: origin,
          open: true,
          register: `${origin}/api/services`,
          agent: `${origin}/api/agent`,
        },
        network: {
          name: ARC.mode === "mainnet" ? "Arc Mainnet" : "Arc Testnet",
          chainId: ARC.chainId,
          caip2: ARC.caip2,
          asset: "USDC",
          assetAddress: ARC.usdcAddress,
          explorer: ARC.explorer,
        },
        settlement: {
          facilitator:
            process.env.GATEWAY_FACILITATOR_URL ??
            "https://gateway-api-testnet.circle.com",
          protocol: "circle-gateway",
          batching: true,
        },
        resources,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    )
  );
}

function inferOutputSchema(sample: unknown): Record<string, unknown> {
  if (!sample || typeof sample !== "object") return { type: "object" };
  const props: Record<string, { type: string }> = {};
  for (const [k, v] of Object.entries(sample as Record<string, unknown>)) {
    props[k] = { type: typeof v };
  }
  return { type: "object", properties: props };
}
