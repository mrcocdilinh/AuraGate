import { NextRequest, NextResponse } from "next/server";
import { getUsdcBalance } from "@/lib/balance";

export const dynamic = "force-dynamic";

/** Read an address's on-chain USDC balance on Arc. GET ?address=0x… */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  const result = await getUsdcBalance(address);
  return NextResponse.json(result);
}
