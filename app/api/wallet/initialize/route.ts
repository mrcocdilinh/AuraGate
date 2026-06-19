import { NextRequest, NextResponse } from "next/server";
import { initializeWallet } from "@/lib/circle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const userToken = b?.userToken as string | undefined;
  if (!userToken) return NextResponse.json({ error: "userToken required" }, { status: 400 });
  return NextResponse.json(await initializeWallet(userToken));
}