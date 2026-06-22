import { NextRequest, NextResponse } from "next/server";
import { probeX402Endpoint } from "@/lib/x402-probe";
import { assertPublicHttpUrl } from "@/lib/safe-url";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Validate that a seller's endpoint speaks x402 correctly — run from the
 * "Test endpoint" button before listing. Body: { url, method?, price? }.
 * Returns the full diagnostic checklist so the seller can fix issues.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "services:probe", 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  if (!b?.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let url: string;
  try {
    url = await assertPublicHttpUrl(String(b.url));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "url must be a valid public URL" },
      { status: 400 }
    );
  }

  const method = b.method === "POST" ? "POST" : "GET";
  const price = b.price ? String(b.price) : undefined;
  const result = await probeX402Endpoint(url, method, price);
  return NextResponse.json(result);
}
