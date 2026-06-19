"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Service } from "@/lib/types";
import { usd } from "@/lib/format";
import { CategoryPill } from "@/components/ui";

const CATEGORIES = ["all", "market-insight", "oracle", "ai", "data", "compute"];

export default function MarketplacePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const okCat = cat === "all" || s.category === cat;
      const okQ =
        !q ||
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.description.toLowerCase().includes(q.toLowerCase());
      return okCat && okQ;
    });
  }, [services, q, cat]);

  return (
    <div className="container-page py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="mt-1 text-sm text-muted">
            {services.length} services · pay USDC per request via x402
          </p>
        </div>
        <input
          className="input sm:max-w-xs"
          placeholder="Search services…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`badge capitalize transition ${
              cat === c ? "!border-primary/70 !text-ink" : "hover:!text-ink"
            }`}
          >
            {c.replace("-", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 text-sm text-muted">Loading…</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link key={s.slug} href={`/services/${s.slug}`} className="card group p-5 transition hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <CategoryPill category={s.category} />
                <span className="text-sm font-bold text-mint">
                  {usd(s.price)}
                  <span className="text-xs font-normal text-muted">/req</span>
                </span>
              </div>
              <h3 className="mt-3 font-semibold group-hover:text-primary">{s.name}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted">{s.description}</p>
              <p className="mt-4 text-xs text-muted">by {s.sellerName}</p>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted">No services match.</p>
          )}
        </div>
      )}
    </div>
  );
}