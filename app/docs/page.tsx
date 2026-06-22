import type { Metadata } from "next";
import { headers } from "next/headers";
import { listServices } from "@/lib/store";
import { DocsContent } from "./doc-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Docs · Buy & sell APIs · AuraGate",
  description:
    "How AI agents buy APIs with USDC over x402, how sellers list their own x402 endpoint, and how to withdraw funds. Available in English, Tiếng Việt, 中文, 日本語, 한국어.",
};

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function DocsPage() {
  const [all, base] = await Promise.all([listServices(), origin()]);
  const services = all.map((s) => ({
    slug: s.slug,
    name: s.name,
    sellerName: s.sellerName,
    method: s.method,
    price: s.price,
  }));
  return <DocsContent services={services} base={base} />;
}
