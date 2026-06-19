import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, CIRCLE_APP_ID } from "@/lib/circle";

export const dynamic = "force-dynamic";

/**
 * Mint a Circle session token for a user (keyed by email or social id).
 * Used by the client Web SDK to create/operate a user-controlled wallet.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const userId = b?.userId as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const token = await createSessionToken(userId);
  return NextResponse.json({ ...token, appId: CIRCLE_APP_ID });
}