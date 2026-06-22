"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Service, Receipt } from "@/lib/types";
import { usd } from "@/lib/format";
import { CategoryPill, Stars, Skeleton } from "@/components/ui";
import { isTrustedReceipt } from "@/lib/trust";

const CATEGORIES = ["all", "market-insight", "oracle", "ai", "data", "compute"];
type SortKey = "popular" | "rating" | "price-asc" | "price-desc" | "newest";

export default function MarketplacePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/receipts").then((r) => r.json()),
    ])
      .then(([s, r]) => {
        setServices(s.services ?? []);
        setReceipts(r.receipts ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Per-service aggregates: call count and average rating.
  const stats = useMemo(() => {
    const m: Record<string, { calls: number; ratingSum: number; rated: number }> = {};
    for (const r of receipts.filter(isTrustedReceipt)) {
      const e = (m[r.serviceSlug] ??= { calls: 0, ratingSum: 0, rated: 0 });
      e.calls += 1;
      if (r.rating) {
        e.ratingSum += r.rating;
        e.rated += 1;
      }
    }
    return m;
  }, [receipts]);

  const avgRating = (slug: string) => {
    const e = stats[slug];
    return e && e.rated > 0 ? e.ratingSum / e.rated : null;
  };
  const calls = (slug: string) => stats[slug]?.calls ?? 0;

  const filtered = useMemo(() => {
    const list = services.filter((s) => {
      const okCat = cat === "all" || s.category === cat;
      const hay = `${s.name} ${s.description} ${(s.tags ?? []).join(" ")} ${s.sellerName}`.toLowerCase();
      const okQ = !q || hay.includes(q.toLowerCase());
      return okCat && okQ;
    });
    const by: Record<SortKey, (a: Service, b: Service) => number> = {
      popular: (a, b) => calls(b.slug) - calls(a.slug),
      rating: (a, b) => (avgRating(b.slug) ?? 0) - (avgRating(a.slug) ?? 0),
      "price-asc": (a, b) => Number(a.price) - Number(b.price),
      "price-desc": (a, b) => Number(b.price) - Number(a.price),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return [...list].sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, q, cat, sort, stats]);

  return (
    <div className="container-page py-10">
      <div>
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Browse {services.length} data &amp; API services. AI agents pay a few cents
          in USDC per request — no sign-up, no API key. Click any card to see details.
        </p>
      </div>

      {/* Toolbar: search + sort on one row, category filters below */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-panel/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
            <input
              className="input pl-9"
              placeholder="Search by name, tag or seller…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="input w-full !py-2.5 text-sm sm:w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="popular">Sort: Most popular</option>
            <option value="rating">Sort: Highest rated</option>
            <option value="price-asc">Sort: Price low → high</option>
            <option value="price-desc">Sort: Price high → low</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Filter:</span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`badge capitalize transition ${cat === c ? "!border-primary/70 !bg-primary/15 !text-ink" : "hover:!text-ink"}`}
            >
              {c === "all" ? "All" : c.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Showing {filtered.length} of {services.length} services
      </p>

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-5 w-40" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const rating = avgRating(s.slug);
            return (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="card group flex flex-col p-5 transition hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <CategoryPill category={s.category} />
                  <span className="text-sm font-bold text-mint">
                    {usd(s.price)}
                    <span className="text-xs font-normal text-muted">/req</span>
                  </span>
                </div>
                <h3 className="mt-3 font-semibold group-hover:text-primary">{s.name}</h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted">{s.description}</p>

                {s.tags && s.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-md bg-panel2/80 px-1.5 py-0.5 text-[10px] text-muted">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                  <span className="text-xs text-muted">by {s.sellerName}</span>
                  <div className="flex items-center gap-2">
                    {rating !== null ? (
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <Stars value={rating} /> {rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted">{calls(s.slug)} calls</span>
                    )}
                    {s.verified && <span className="h-1.5 w-1.5 rounded-full bg-mint" title="Verified endpoint" />}
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted">No services match.</p>
          )}
        </div>
      )}
    </div>
  );
}
