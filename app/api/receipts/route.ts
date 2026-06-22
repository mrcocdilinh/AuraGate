import { NextRequest, NextResponse } from "next/server";
import { getReceipt, listReceipts, rateReceipt } from "@/lib/store";
import { authorizeOwner } from "@/lib/owner-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ receipts: await listReceipts() });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "receipts:rate", 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  if (!b?.id || typeof b.rating !== "number") {
    return NextResponse.json({ error: "id and rating required" }, { status: 400 });
  }
  const receipt = await getReceipt(String(b.id));
  if (!receipt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owner = await authorizeOwner({
    body: b,
    expectedAddress: receipt.payer,
    action: "receipt:rate",
    subject: receipt.id,
    extra: { rating: Math.max(1, Math.min(5, Math.round(b.rating))) },
  });
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: 403 });
  }
  const r = await rateReceipt(b.id, b.rating);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ receipt: r });
}
