import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * For PIN-based Circle Apps: creates a challenge that sets up the user's PIN
 * AND creates their ARC-TESTNET wallet in a single step.
 * The client SDK executes the challenge to show the PIN setup modal.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const userToken = b?.userToken as string | undefined;
  if (!userToken) {
    return NextResponse.json({ error: "userToken required" }, { status: 400 });
  }
  try {
    const { initiateUserControlledWalletsClient } = await import(
      "@circle-fin/user-controlled-wallets"
    );
    const c = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY ?? "",
    });
    const res = await (c as unknown as {
      createUserPinWithWallets: (
        userToken: string,
        body: { idempotencyKey: string; blockchains: string[] }
      ) => Promise<{ data?: { challengeId?: string } }>;
    }).createUserPinWithWallets(userToken, {
      idempotencyKey: crypto.randomUUID(),
      blockchains: ["ARC-TESTNET"],
    });
    return NextResponse.json({ challengeId: res.data?.challengeId });
  } catch (e) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? (e instanceof Error ? e.message : String(e));
    console.error("[wallet/init-pin]", msg, e);
    return NextResponse.json(
      { error: "circle_init_pin_failed", detail: msg },
      { status: 502 }
    );
  }
}
