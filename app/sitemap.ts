import type { MetadataRoute } from "next";
import { listServices } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://auragate.app";
  const routes = ["", "/services", "/sellers", "/dashboard", "/receipts", "/playground", "/docs"].map(
    (p) => ({ url: `${base}${p}`, lastModified: new Date() })
  );
  const services = await listServices().catch(() => []);
  const serviceRoutes = services.map((s) => ({
    url: `${base}/services/${s.slug}`,
    lastModified: new Date(s.createdAt),
  }));
  return [...routes, ...serviceRoutes];
}
