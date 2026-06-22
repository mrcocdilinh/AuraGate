import { NextRequest, NextResponse } from "next/server";
import { getService } from "@/lib/store";
import { initUsdcWithdrawal } from "@/lib/circle";
import { createPendingBuy } from "@/lib/pending-buys";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Initiate a real USDC purchase from a connected Circle wallet.
 *
 * Body: { slug, userToken }
 * Returns: { challengeId, pendingId }
 *
 * The client executes the Circle SDK challenge to authorise the USDC
 * transfer, then calls POST /api/buy/confirm to receive the data.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "buy:init", 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  if (!b?.slug || !b?.userToken) {
    return NextResponse.json({ error: "slug and userToken are required" }, { status: 400 });
  }

  const service = await getService(String(b.slug));
  if (!service) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }
  if (!service.active) {
    return NextResponse.json({ error: "service_inactive" }, { status: 410 });
  }
  if (service.externalUrl) {
    // Seller-hosted endpoints need a raw EIP-3009 signature — not possible with
    // Circle user-controlled wallets in the browser. Direct them to use curl/agent.
    return NextResponse.json(
      { error: "external_endpoint", detail: "This seller hosts their own endpoint. Use curl or the agent script to pay with x402." },
      { status: 422 }
    );
  }

  const transfer = await initUsdcWithdrawal({
    userToken: String(b.userToken),
    destinationAddress: service.sellerAddress,
    amount: service.price,
  });

  if (transfer.error) {
    return NextResponse.json({ error: transfer.error, detail: transfer.detail }, { status: 400 });
  }

  const pendingId = await createPendingBuy(service.slug, service.price, service.sellerAddress);
  return NextResponse.json({ challengeId: transfer.challengeId, pendingId });
}
