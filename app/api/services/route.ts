import { NextRequest, NextResponse } from "next/server";
import {
  addService,
  listServices,
  getService,
  setServiceActive,
  deleteService,
} from "@/lib/store";
import type { ServiceCategory } from "@/lib/types";
import { probeX402Endpoint } from "@/lib/x402-probe";
import { assertPublicHttpUrl } from "@/lib/safe-url";
import { authorizeOwner } from "@/lib/owner-auth";
import { rateLimit } from "@/lib/rate-limit";

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

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "services:post", 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
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
  const sellerAddress = String(b.sellerAddress).trim();
  const owner = await authorizeOwner({
    body: b,
    expectedAddress: sellerAddress,
    action: "service:create",
    subject: slug,
    extra: { price: String(priceNum), method },
  });
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: 403 });
  }

  let externalUrl: string | undefined;
  if (b.externalUrl) {
    try {
      externalUrl = await assertPublicHttpUrl(String(b.externalUrl));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "externalUrl must be a valid public URL" },
        { status: 400 }
      );
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

  // Optional JSON-schema descriptors — accept an object or a JSON string.
  const parseSchema = (v: unknown): { ok: boolean; value?: unknown } => {
    if (v === undefined || v === null || v === "") return { ok: true };
    if (typeof v === "object") return { ok: true, value: v };
    if (typeof v === "string") {
      try { return { ok: true, value: JSON.parse(v) }; } catch { return { ok: false }; }
    }
    return { ok: false };
  };
  const inputParsed = parseSchema(b.inputSchema);
  if (!inputParsed.ok) {
    return NextResponse.json({ error: "inputSchema must be valid JSON" }, { status: 400 });
  }
  const outputParsed = parseSchema(b.outputSchema);
  if (!outputParsed.ok) {
    return NextResponse.json({ error: "outputSchema must be valid JSON" }, { status: 400 });
  }

  // For seller-hosted endpoints, validate the x402 challenge live. We surface
  // the full diagnostic so the seller learns *why* it didn't verify.
  const probe = externalUrl
    ? await probeX402Endpoint(externalUrl, method, String(priceNum))
    : null;
  const verified = probe ? probe.ok : true;

  const svc = await addService({
    slug,
    name: String(b.name).slice(0, 80),
    description: String(b.description ?? "").slice(0, 400),
    category,
    sellerAddress,
    sellerName: String(b.sellerName ?? "Anonymous Seller").slice(0, 60),
    price: String(priceNum),
    method,
    endpoint: externalUrl ?? `/api/premium/${slug}`,
    externalUrl,
    docsUrl: b.docsUrl ? String(b.docsUrl).slice(0, 300) : undefined,
    tags,
    inputSchema: inputParsed.value,
    outputSchema: outputParsed.value,
    verified,
    sampleResponse,
  });

  return NextResponse.json({ service: svc, probe }, { status: 201 });
}

/** Deactivate / reactivate a service. Body: { slug, sellerAddress, active }. */
export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, "services:patch", 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  if (!b?.slug || typeof b.active !== "boolean") {
    return NextResponse.json({ error: "slug and active required" }, { status: 400 });
  }
  const svc = await getService(b.slug);
  if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owner = await authorizeOwner({
    body: b,
    expectedAddress: svc.sellerAddress,
    action: "service:update",
    subject: svc.slug,
    extra: { active: b.active },
  });
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: 403 });
  }
  const updated = await setServiceActive(b.slug, b.active);
  return NextResponse.json({ service: updated });
}

/** Remove a service. Body: { slug, sellerAddress }. */
export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, "services:delete", 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(limited.retryAfter) } });
  }
  const b = await req.json().catch(() => null);
  if (!b?.slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  const svc = await getService(b.slug);
  if (!svc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owner = await authorizeOwner({
    body: b,
    expectedAddress: svc.sellerAddress,
    action: "service:delete",
    subject: svc.slug,
  });
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: 403 });
  }
  await deleteService(b.slug);
  return NextResponse.json({ ok: true });
}
