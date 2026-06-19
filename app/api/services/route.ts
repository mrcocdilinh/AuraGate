import { NextRequest, NextResponse } from "next/server";
import { addService, listServices } from "@/lib/store";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ services: listServices() });
}

/** Seller registers a new service (dynamic registry). */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || !b.name || !b.sellerAddress || !b.price) {
    return NextResponse.json(
      { error: "name, sellerAddress and price are required" },
      { status: 400 }
    );
  }

  const slug = String(b.slug ?? b.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  const svc = addService({
    slug,
    name: String(b.name),
    description: String(b.description ?? ""),
    category: (b.category as ServiceCategory) ?? "data",
    sellerAddress: String(b.sellerAddress),
    sellerName: String(b.sellerName ?? "Anonymous Seller"),
    price: String(b.price),
    method: b.method === "POST" ? "POST" : "GET",
    endpoint: `/api/premium/${slug}`,
    sampleResponse: b.sampleResponse,
  });

  return NextResponse.json({ service: svc }, { status: 201 });
}