import { NextRequest, NextResponse } from "next/server";
import { createEmailDeviceToken, CIRCLE_APP_ID } from "@/lib/circle";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Mint a device token for Email OTP login (also triggers the OTP email). */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "wallet:email-token", 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  const deviceId = b?.deviceId as string | undefined;
  const email = b?.email as string | undefined;
  if (!deviceId || !email) {
    return NextResponse.json(
      { error: "deviceId and email required" },
      { status: 400 }
    );
  }
  try {
    const token = await createEmailDeviceToken(deviceId, email);
    return NextResponse.json({ ...token, appId: CIRCLE_APP_ID });
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string }; status?: number } })
        ?.response?.data?.message ??
      (e instanceof Error ? e.message : String(e));
    console.error("[wallet/email-token]", msg, e);
    return NextResponse.json(
      { error: "circle_email_token_failed", detail: msg },
      { status: 502 }
    );
  }
}
