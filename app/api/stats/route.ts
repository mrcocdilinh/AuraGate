import { NextResponse } from "next/server";
import { listServices, listReceipts } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [services, receipts] = await Promise.all([listServices(), listReceipts()]);
  const revenue = receipts.reduce((a, r) => a + Number(r.amount), 0);
  const buyers = new Set(receipts.map((r) => r.payer)).size;
  return NextResponse.json({
    services: services.length,
    requests: receipts.length,
    revenue: revenue.toFixed(4),
    buyers,
  });
}
