import { NextRequest, NextResponse } from "next/server";
import { getService, recordPayment, recordReceipt } from "@/lib/store";
import { buildChallenge, settlePayment } from "@/lib/x402";
import { resultHash } from "@/lib/format";
import { ARC } from "@/lib/arc";

export const dynamic = "force-dynamic";

async function produce(slug: string, fallback: unknown): Promise<unknown> {
  if (slug === "market-insight") {
    const base = process.env.AURAPREDICT_INDEXER_URL ?? "https://api.aurapredict.xyz";
    try {
      const r = await fetch(`${base}/api/stats`, { signal: AbortSignal.timeout(2500) });
      if (r.ok) return { source: "aurapredict-indexer", generatedAt: new Date().toISOString(), stats: await r.json() };
    } catch { /* fall through */ }
    return { source: "aurapredict-sample", generatedAt: new Date().toISOString(), ...((fallback as object) ?? {}) };
  }
  return { generatedAt: new Date().toISOString(), data: fallback };
}

async function handle(req: NextRequest, slug: string) {
  const service = getService(slug);
  if (!service || !service.active) return NextResponse.json({ error: "service_not_found" }, { status: 404 });

  const payment = await settlePayment(req, service.price, service.sellerAddress);
  if (!payment) return NextResponse.json(buildChallenge(service.price, service.sellerAddress), { status: 402 });

  const body = await produce(slug, service.sampleResponse);
  const p = recordPayment({ serviceSlug: slug, buyerAddress: payment.payer, amount: payment.amount, status: "settled", txHash: payment.transaction, network: payment.network });
  const hash = resultHash(body);
  const receipt = recordReceipt({ paymentId: p.id, serviceSlug: slug, payer: payment.payer, amount: payment.amount, resultHash: hash, onchainTx: payment.transaction });

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "x-payment-network": payment.network,
      "x-receipt-id": receipt.id,
      "x-result-hash": hash,
      ...(payment.transaction ? { "x-settlement-tx": payment.transaction } : {}),
      "x-arc-explorer": ARC.explorer,
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  return handle(req, (await ctx.params).service);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  return handle(req, (await ctx.params).service);
}