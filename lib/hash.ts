import { keccak256, toBytes } from "viem";

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

export function resultHash(body: unknown): `0x${string}` {
  const payload = typeof body === "string" ? body : stableStringify(body);
  return keccak256(toBytes(payload));
}

export function requestHash(input: {
  method: string;
  url: string;
  serviceSlug: string;
  payer?: string;
}): `0x${string}` {
  const u = new URL(input.url);
  return keccak256(
    toBytes(
      stableStringify({
        method: input.method.toUpperCase(),
        path: u.pathname,
        search: u.searchParams.toString(),
        serviceSlug: input.serviceSlug,
        payer: input.payer ?? "",
      })
    )
  );
}
