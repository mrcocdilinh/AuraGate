import { ARC } from "./arc";
import { toAtomicUSDC } from "./x402";

/** One line in the verification checklist shown to sellers. */
export interface ProbeCheck {
  label: string;
  /** "pass" = good, "fail" = blocks verification, "warn" = advisory only. */
  status: "pass" | "fail" | "warn";
  detail?: string;
}

export interface ProbeResult {
  /** True when the endpoint is a usable x402 endpoint (no failing checks). */
  ok: boolean;
  /** Did we get any HTTP response at all? */
  reachable: boolean;
  /** HTTP status of the un-paid probe call (should be 402). */
  status: number | null;
  checks: ProbeCheck[];
  /** The parsed 402 challenge body, when present. */
  challenge?: unknown;
  /** One-line human summary. */
  summary: string;
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
}

/**
 * Probe a seller-hosted endpoint and validate it speaks x402 correctly.
 *
 * A compliant endpoint, called WITHOUT payment, must reply `402 Payment
 * Required` with a JSON challenge body containing an `accepts` array. Each
 * accept entry advertises how to pay: `amount` (atomic units), `payTo` (the
 * recipient address), plus `scheme`/`network`/`asset`. We surface every check
 * so a seller can see exactly what's missing instead of a blank "unverified".
 *
 * `price` (optional, human USDC string e.g. "0.01") lets us warn when the
 * amount the endpoint asks for doesn't match what the seller is listing.
 */
export async function probeX402Endpoint(
  url: string,
  method: string,
  price?: string
): Promise<ProbeResult> {
  const checks: ProbeCheck[] = [];
  const m = method === "POST" ? "POST" : "GET";

  // ── 1. Reachability ────────────────────────────────────────────────────────
  let res: Response;
  try {
    res = await fetch(url, {
      method: m,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: m === "POST" ? { "content-type": "application/json" } : {},
      ...(m === "POST" ? { body: "{}" } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const timeout = /timeout|abort/i.test(msg);
    checks.push({
      label: "Endpoint is reachable",
      status: "fail",
      detail: timeout
        ? "No response within 5s — check the URL is public and online."
        : `Could not connect: ${msg}`,
    });
    return {
      ok: false,
      reachable: false,
      status: null,
      checks,
      summary: timeout ? "Endpoint timed out" : "Endpoint unreachable",
    };
  }

  checks.push({
    label: "Endpoint is reachable",
    status: "pass",
    detail: `Responded with HTTP ${res.status}.`,
  });

  if (res.status >= 300 && res.status < 400) {
    checks.push({
      label: "Endpoint does not redirect",
      status: "fail",
      detail:
        "Redirects are not followed during verification. Use the final public x402 endpoint URL.",
    });
    return {
      ok: false,
      reachable: true,
      status: res.status,
      checks,
      summary: `Returned redirect ${res.status}, not a direct x402 challenge`,
    };
  }

  // ── 2. Returns 402 when unpaid ──────────────────────────────────────────────
  if (res.status !== 402) {
    checks.push({
      label: "Returns 402 Payment Required when unpaid",
      status: "fail",
      detail:
        res.status === 200
          ? "Got 200 OK — the endpoint served data without asking for payment. An x402 endpoint must require payment first."
          : `Got HTTP ${res.status}, expected 402. The unpaid call must return 402 with a payment challenge.`,
    });
    return {
      ok: false,
      reachable: true,
      status: res.status,
      checks,
      summary: `Returned ${res.status}, not 402`,
    };
  }
  checks.push({ label: "Returns 402 Payment Required when unpaid", status: "pass" });

  // ── 3. Body is JSON ─────────────────────────────────────────────────────────
  let challenge: unknown;
  const raw = await res.text();
  try {
    challenge = JSON.parse(raw);
  } catch {
    checks.push({
      label: "402 body is a JSON challenge",
      status: "fail",
      detail: "The 402 response body is not valid JSON. It must be a JSON x402 challenge.",
    });
    return {
      ok: false,
      reachable: true,
      status: 402,
      checks,
      summary: "402 body is not JSON",
    };
  }
  checks.push({ label: "402 body is a JSON challenge", status: "pass" });

  // ── 4. Has an `accepts` array ───────────────────────────────────────────────
  const body = (challenge ?? {}) as Record<string, unknown>;
  const accepts = body.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    checks.push({
      label: "Challenge advertises an `accepts` array",
      status: "fail",
      detail:
        "x402 v2 challenges must include a non-empty `accepts` array describing how to pay (amount, payTo, network).",
    });
    return {
      ok: false,
      reachable: true,
      status: 402,
      checks,
      challenge,
      summary: "Missing `accepts` payment options",
    };
  }
  checks.push({
    label: "Challenge advertises an `accepts` array",
    status: "pass",
    detail: `${accepts.length} payment option(s).`,
  });

  // ── 5. First accept entry carries amount + payTo ────────────────────────────
  const a = (accepts[0] ?? {}) as Record<string, unknown>;
  const amount = pick(a, "amount", "maxAmountRequired");
  const payTo = pick(a, "payTo", "recipient", "address");

  if (amount == null) {
    checks.push({
      label: "Payment option has an `amount`",
      status: "fail",
      detail: "The accept entry is missing `amount` (price in atomic USDC units).",
    });
  } else {
    const num = Number(amount);
    checks.push({
      label: "Payment option has an `amount`",
      status: Number.isFinite(num) && num > 0 ? "pass" : "fail",
      detail: `amount = ${String(amount)} atomic units.`,
    });
  }

  if (payTo == null) {
    checks.push({
      label: "Payment option has a `payTo` recipient",
      status: "fail",
      detail: "Missing `payTo` — the wallet that receives USDC.",
    });
  } else {
    const ok = ADDR_RE.test(String(payTo));
    checks.push({
      label: "Payment option has a `payTo` recipient",
      status: ok ? "pass" : "warn",
      detail: ok
        ? `payTo = ${String(payTo)}`
        : `payTo = ${String(payTo)} — doesn't look like a 0x… address.`,
    });
  }

  // ── 6. Advisory checks (warnings, don't block verification) ──────────────────
  const scheme = pick(a, "scheme");
  checks.push(
    scheme
      ? { label: "Declares a payment `scheme`", status: "pass", detail: `scheme = ${String(scheme)}` }
      : { label: "Declares a payment `scheme`", status: "warn", detail: 'Recommended: "exact".' }
  );

  const network = pick(a, "network");
  if (!network) {
    checks.push({
      label: "Targets the Arc network",
      status: "warn",
      detail: `Recommended network: ${ARC.caip2}.`,
    });
  } else {
    const onArc = String(network) === ARC.caip2 || String(network).includes("5042002");
    checks.push({
      label: "Targets the Arc network",
      status: onArc ? "pass" : "warn",
      detail: `network = ${String(network)}${onArc ? "" : ` (AuraGate settles on ${ARC.caip2}).`}`,
    });
  }

  // ── 7. Amount matches the listed price (advisory) ───────────────────────────
  if (price && amount != null) {
    const expected = toAtomicUSDC(price);
    const matches = String(amount) === expected;
    checks.push({
      label: "Amount matches your listed price",
      status: matches ? "pass" : "warn",
      detail: matches
        ? `Both = ${expected} atomic units ($${price}).`
        : `Endpoint asks ${String(amount)}, you're listing $${price} (${expected}). Buyers pay what the endpoint asks.`,
    });
  }

  const failed = checks.some((c) => c.status === "fail");
  const warned = checks.filter((c) => c.status === "warn").length;
  return {
    ok: !failed,
    reachable: true,
    status: 402,
    checks,
    challenge,
    summary: failed
      ? "Not a valid x402 endpoint yet"
      : warned > 0
        ? `Valid x402 endpoint · ${warned} warning(s)`
        : "Valid x402 endpoint ✓",
  };
}
