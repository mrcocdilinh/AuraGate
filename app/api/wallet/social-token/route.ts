import { NextRequest, NextResponse } from "next/server";
import { createSocialDeviceToken, CIRCLE_APP_ID } from "@/lib/circle";

export const dynamic = "force-dynamic";

/** Mint a device token for social (Google) login. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const deviceId = b?.deviceId as string | undefined;
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }
  try {
    const token = await createSocialDeviceToken(deviceId);
    return NextResponse.json({ ...token, appId: CIRCLE_APP_ID });
  } catch (e) {
    console.error("[wallet/social-token]", e);
    return NextResponse.json(
      { error: "circle_social_token_failed" },
      { status: 502 }
    );
  }
}
