import { NextRequest, NextResponse } from "next/server";
import { probeX402Endpoint } from "@/lib/x402-probe";

export const dynamic = "force-dynamic";

/**
 * Validate that a seller's endpoint speaks x402 correctly — run from the
 * "Test endpoint" button before listing. Body: { url, method?, price? }.
 * Returns the full diagnostic checklist so the seller can fix issues.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let url: string;
  try {
    const u = new URL(String(b.url));
    if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
    url = u.toString();
  } catch {
    return NextResponse.json(
      { error: "url must be a valid http(s) URL" },
      { status: 400 }
    );
  }

  const method = b.method === "POST" ? "POST" : "GET";
  const price = b.price ? String(b.price) : undefined;
  const result = await probeX402Endpoint(url, method, price);
  return NextResponse.json(result);
}
