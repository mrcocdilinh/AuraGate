import { NextRequest, NextResponse } from "next/server";
import { initUsdcWithdrawal } from "@/lib/circle";

export const dynamic = "force-dynamic";

const ADDR = /^0x[a-fA-F0-9]{40}$/;

/**
 * Start a USDC withdrawal from the signed-in user's Arc wallet.
 * Body: { userToken, destinationAddress, amount }.
 * Returns { challengeId } for the client SDK to execute, or an error.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.userToken) {
    return NextResponse.json({ error: "userToken is required" }, { status: 400 });
  }
  if (!ADDR.test(String(b.destinationAddress ?? ""))) {
    return NextResponse.json(
      { error: "destinationAddress must be a valid 0x… address" },
      { status: 400 }
    );
  }
  const amount = Number(b.amount);
  if (!isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const result = await initUsdcWithdrawal({
    userToken: String(b.userToken),
    destinationAddress: String(b.destinationAddress),
    amount: String(b.amount),
  });

  if (result.error) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
