import { NextRequest, NextResponse } from "next/server";
import { listReceipts, rateReceipt } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ receipts: listReceipts() });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.id || typeof b.rating !== "number") {
    return NextResponse.json({ error: "id and rating required" }, { status: 400 });
  }
  const r = rateReceipt(b.id, b.rating);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ receipt: r });
}