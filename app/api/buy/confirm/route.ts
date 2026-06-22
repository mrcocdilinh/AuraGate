import { NextRequest, NextResponse } from "next/server";
import { getService, recordPayment, recordReceipt } from "@/lib/store";
import { consumePendingBuy } from "@/lib/pending-buys";
import { produceServiceData } from "@/lib/service-providers";
import { resultHash } from "@/lib/format";
import { ARC } from "@/lib/arc";
import { writeReceiptOnChain } from "@/lib/onchain";

export const dynamic = "force-dynamic";

const ADDR = /^0x[a-fA-F0-9]{40}$/;

/**
 * Confirm a completed Circle wallet payment and deliver the service data.
 *
 * Body: { pendingId, walletAddress }
 *
 * Called after the client has executed the Circle SDK challenge. The pendingId
 * links back to the pending buy (slug + price) created in POST /api/buy.
 * We trust Circle to settle the USDC transfer — delivery is optimistic.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.pendingId || !b?.walletAddress) {
    return NextResponse.json({ error: "pendingId and walletAddress are required" }, { status: 400 });
  }
  if (!ADDR.test(String(b.walletAddress))) {
    return NextResponse.json({ error: "walletAddress must be a valid 0x… address" }, { status: 400 });
  }

  const pending = consumePendingBuy(String(b.pendingId));
  if (!pending) {
    return NextResponse.json(
      { error: "invalid_or_expired", detail: "The purchase session expired. Please try again." },
      { status: 404 }
    );
  }

  const service = await getService(pending.slug);
  if (!service) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  // Produce the live data (falls back to sample on upstream failure).
  const syntheticReq = new Request(`${req.nextUrl.origin}/api/premium/${pending.slug}`) as Parameters<typeof produceServiceData>[1];
  const data = await produceServiceData(pending.slug, syntheticReq, service.sampleResponse);
  const hash = resultHash(JSON.stringify(data));

  // Record payment + receipt.
  const payment = await recordPayment({
    serviceSlug: pending.slug,
    buyerAddress: String(b.walletAddress),
    amount: pending.price,
    status: "settled",
    network: ARC.caip2,
  });

  const receipt = await recordReceipt({
    paymentId: payment.id,
    serviceSlug: pending.slug,
    payer: String(b.walletAddress),
    amount: pending.price,
    resultHash: hash,
  });

  // Fire-and-forget on-chain write (best effort).
  writeReceiptOnChain({
    payer: String(b.walletAddress),
    serviceSlug: pending.slug,
    amountUsd: pending.price,
    resultHash: hash,
  }).catch(() => null);

  return NextResponse.json({
    data,
    receipt: {
      id: receipt.id,
      serviceSlug: receipt.serviceSlug,
      payer: receipt.payer,
      amount: receipt.amount,
      resultHash: receipt.resultHash,
      createdAt: receipt.createdAt,
    },
  });
}
