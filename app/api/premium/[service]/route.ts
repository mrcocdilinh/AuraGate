import { NextRequest, NextResponse } from "next/server";
import { getService, recordPayment, recordReceipt, updateReceiptOnchainTx } from "@/lib/store";
import { processPayment } from "@/lib/x402";
import { resultHash } from "@/lib/format";
import { writeReceiptOnChain } from "@/lib/onchain";
import { ARC } from "@/lib/arc";

export const dynamic = "force-dynamic";

async function produce(slug: string, fallback: unknown): Promise<unknown> {
  if (slug === "market-insight") {
    const base = process.env.AURAPREDICT_INDEXER_URL ?? "https://api.aurapredict.xyz";
    try {
      const r = await fetch(`${base}/api/stats`, {
        signal: AbortSignal.timeout(2500),
      });
      if (r.ok) {
        return { source: "aurapredict-indexer", generatedAt: new Date().toISOString(), stats: await r.json() };
      }
    } catch { /* fall through */ }
    return { source: "aurapredict-sample", generatedAt: new Date().toISOString(), ...((fallback as object) ?? {}) };
  }
  return { generatedAt: new Date().toISOString(), data: fallback };
}

async function handle(req: NextRequest, slug: string) {
  const service = await getService(slug);
  if (!service || !service.active) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const outcome = await processPayment(req, service.price, service.sellerAddress);
  if (outcome.kind === "challenge") {
    return outcome.response;
  }
  const payment = outcome.payment;

  const body = await produce(slug, service.sampleResponse);
  const p = await recordPayment({
    serviceSlug: slug,
    buyerAddress: payment.payer,
    amount: payment.amount,
    status: "settled",
    txHash: payment.transaction,
    network: payment.network,
  });
  const hash = resultHash(body);
  const receipt = await recordReceipt({
    paymentId: p.id,
    serviceSlug: slug,
    payer: payment.payer,
    amount: payment.amount,
    resultHash: hash,
    onchainTx: payment.transaction,
  });

  // Fire-and-forget on-chain write — doesn't block the response
  writeReceiptOnChain({
    payer: payment.payer,
    serviceSlug: slug,
    amountUsd: payment.amount,
    resultHash: hash,
  }).then(async (tx) => {
    if (tx) {
      await updateReceiptOnchainTx(receipt.id, tx);
      console.log("[onchain] receipt tx:", tx);
    }
  });

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "x-payment-network": payment.network,
      "x-receipt-id": receipt.id,
      "x-result-hash": hash,
      ...(payment.transaction ? { "x-settlement-tx": payment.transaction } : {}),
      "x-arc-explorer": ARC.explorer,
      // Echo Circle's settlement header so the Gateway buyer client can read it.
      ...(outcome.responseHeaders ?? {}),
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  return handle(req, (await ctx.params).service);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  return handle(req, (await ctx.params).service);
}
