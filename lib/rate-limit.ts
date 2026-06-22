import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __agRateLimit?: Map<string, Bucket> };
function buckets(): Map<string, Bucket> {
  if (!g.__agRateLimit) g.__agRateLimit = new Map();
  return g.__agRateLimit;
}

export function rateLimit(
  req: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const existing = buckets().get(key);
  if (!existing || existing.resetAt <= now) {
    buckets().set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true };
}
