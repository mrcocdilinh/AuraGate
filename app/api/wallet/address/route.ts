import { NextRequest, NextResponse } from "next/server";
import { getUserWalletAddress } from "@/lib/circle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Return the Arc wallet address for a user (queried from Circle API). */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "wallet:address", 120, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  const userToken = b?.userToken as string | undefined;
  if (!userToken) {
    return NextResponse.json({ error: "userToken required" }, { status: 400 });
  }
  const address = await getUserWalletAddress(userToken);
  if (!address) {
    return NextResponse.json({ error: "no wallet found" }, { status: 404 });
  }
  return NextResponse.json({ address });
}
