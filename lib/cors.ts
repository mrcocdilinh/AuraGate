/**
 * CORS for the public buyer API. AuraGate is a permissionless marketplace, so
 * any agent — a standalone script, a page on another origin, a `file://` demo —
 * must be able to call the paid endpoints and read the receipt headers.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-payment, x-payer, payment-signature",
  "Access-Control-Expose-Headers":
    "x-receipt-id, x-result-hash, x-settlement-tx, x-payment-network, x-arc-explorer",
  "Access-Control-Max-Age": "86400",
};

/** Attach CORS headers to any Response and return it. */
export function withCors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

/** Preflight (OPTIONS) response. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
