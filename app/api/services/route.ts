import { NextRequest, NextResponse } from "next/server";
import {
  addService,
  listServices,
  getService,
  setServiceActive,
  deleteService,
} from "@/lib/store";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES: ServiceCategory[] = [
  "data",
  "ai",
  "oracle",
  "compute",
  "market-insight",
];

export async function GET() {
  return NextResponse.json({ services: await listServices() });
}

/**
 * Probe a seller-hosted endpoint for a valid x402 challenge. A compliant
 * endpoint replies HTTP 402 when called without payment — that's the
 * verification signal we surface as a "verified" badge.
 */
async function probeVerified(url: string, method: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      signal: AbortSignal.timeout(3500),
      headers: method === "POST" ? { "content-type": "application/json" } : {},
      ...(method === "POST" ? { body: "{}" } : {}),
    });
    return res.status === 402;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || !b.name || !b.sellerAddress || !b.price) {
    return NextResponse.json(
      { error: "name, sellerAddress and price are required" },
      { status: 400 }
    );
  }

  const priceNum = Number(b.price);
  if (!isFinite(priceNum) || priceNum <= 0) {
    return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
  }

  const slug = String(b.slug ?? b.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  if (!slug) {
    return NextResponse.json({ error: "could not derive a slug from name" }, { status: 400 });
  }
  if (await getService(slug)) {
    return NextResponse.json(
      { error: `a service named "${slug}" already exists — pick another name` },
      { status: 409 }
    );
  }

  const category = CATEGORIES.includes(b.category) ? b.category : "data";
  const method = b.method === "POST" ? "POST" : "GET";

  let externalUrl: string | undefined;
  if (b.externalUrl) {
    try {
      const u = new URL(String(b.externalUrl));
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
      externalUrl = u.toString();
    } catch {
      return NextResponse.json({ error: "externalUrl must be a valid http(s) URL" }, { status: 400 });
    }
  }

  const tags = Array.isArray(b.tags)
    ? b.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 8)
    : typeof b.tags === "string"
      ? b.tags.split(",").map((t: string) => t.trim()).filter(Boolean).slice(0, 8)
      : undefined;

  let sampleResponse = b.sampleResponse;
  if (typeof sampleResponse === "string" && sampleResponse.trim()) {
    try {
      sampleResponse = JSON.parse(sampleResponse);
    } catch {
      return NextResponse.json({ error: "sampleResponse must be valid JSON" }, { status: 400 });
    }
  }

  // For seller-hosted endpoints, verify the x402 challenge live.
  const verified = externalUrl ? await probeVerified(externalUrl, method) : true;

  const svc = await addService({
    slug,
    name: String(b.name).slice(0, 80),
    description: String(b.description ?? "").slice(0, 400),
    category,
    sellerAddress: String(b.sellerAddress),
    sellerName: String(b.sellerName ?? "Anonymous Seller").slice(0, 60),
    price: String(priceNum),
    method,
    endpoint: externalUrl ?? `/api/premium/${slug}`,
    externalUrl,
    docsUrl: b.docsUrl ? String(b.docsUrl).slice(0, 300) : undefined,
    tags,
    verified,
    sampleResponse,
  });

  return NextResponse.json({ service: svc }, { status: 201 });
}

/** Deactivate / reactivate a service. Body: { slug, sellerAddress, active }. */
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.slug || typeof b.active !== "boolean") {
    return NextResponse.json({ error: "slug and active required" }, { status: 400 });
  }
  const svc = await getService(b.slug);
  if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (b.sellerAddress && svc.sellerAddress !== b.sellerAddress) {
    return NextResponse.json({ error: "not the owner of this service" }, { status: 403 });
  }
  const updated = await setServiceActive(b.slug, b.active);
  return NextResponse.json({ service: updated });
}

/** Remove a service. Body: { slug, sellerAddress }. */
export async function DELETE(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const svc = await getService(b.slug);
  if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (b.sellerAddress && svc.sellerAddress !== b.sellerAddress) {
    return NextResponse.json({ error: "not the owner of this service" }, { status: 403 });
  }
  await deleteService(b.slug);
  return NextResponse.json({ ok: true });
}
