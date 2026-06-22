import { NextResponse } from "next/server";
import { listServices, listAllReceipts } from "@/lib/store";
import { isTrustedReceipt } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function GET() {
  const [services, receipts] = await Promise.all([listServices(), listAllReceipts()]);
  const trustedReceipts = receipts.filter(isTrustedReceipt);
  const revenue = trustedReceipts.reduce((a, r) => a + Number(r.amount), 0);
  const buyers = new Set(trustedReceipts.map((r) => r.payer)).size;
  return NextResponse.json({
    services: services.length,
    requests: trustedReceipts.length,
    revenue: revenue.toFixed(4),
    buyers,
    totalReceipts: receipts.length,
  });
}
