import { NextRequest, NextResponse } from "next/server";
import { createWalletChallenge } from "@/lib/circle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Create an Arc wallet for an authenticated user; returns a challengeId. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "wallet:create", 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  const userToken = b?.userToken as string | undefined;
  if (!userToken) {
    return NextResponse.json({ error: "userToken required" }, { status: 400 });
  }
  try {
    const res = await createWalletChallenge(userToken);
    return NextResponse.json(res);
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string }; status?: number } })
        ?.response?.data?.message ??
      (e instanceof Error ? e.message : String(e));
    console.error("[wallet/create-wallet]", msg, e);
    return NextResponse.json(
      { error: "circle_create_wallet_failed", detail: msg },
      { status: 502 }
    );
  }
}
