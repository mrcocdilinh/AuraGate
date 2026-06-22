/**
 * Spending controls for the real-wallet buy flow.
 *
 * Mirrors the guardrails Circle Agent Wallets expose (time-bound spend limits +
 * allow/blocklist), but enforced at the registry layer so they apply to the
 * browser "Buy with wallet" path too — not just the playground agent.
 *
 * Limits are configured via env and tracked per wallet address in a rolling
 * window. The tracker is in-memory (globalThis) — per Vercel instance, same
 * acknowledged limitation as the rate limiter. A shared store (Supabase/Redis)
 * is the pre-mainnet upgrade.
 */

const num = (key: string, fallback: number): number => {
  const v = Number(process.env[key]);
  return isFinite(v) && v > 0 ? v : fallback;
};

const list = (key: string): string[] =>
  (process.env[key] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const MAX_PER_TX = num("BUY_MAX_PER_TX_USDC", 1);          // single purchase cap
const WINDOW_CAP = num("BUY_WALLET_WINDOW_CAP_USDC", 5);   // per-wallet rolling cap
const WINDOW_MS = num("BUY_WALLET_WINDOW_MS", 86_400_000); // 24h default

interface Spend {
  total: number;
  resetAt: number;
}

function store(): Map<string, Spend> {
  const g = globalThis as unknown as { __auragateSpend?: Map<string, Spend> };
  if (!g.__auragateSpend) g.__auragateSpend = new Map();
  return g.__auragateSpend;
}

export interface PolicyResult {
  ok: boolean;
  error?: string;
  detail?: string;
}

/**
 * Check (and reserve) spend for a wallet buying from a seller.
 * Call BEFORE initiating the transfer; on success the amount is recorded against
 * the wallet's rolling window. Returns `ok: false` with a reason when blocked.
 */
export function checkSpendPolicy(params: {
  wallet: string;
  seller: string;
  amountUsd: string;
}): PolicyResult {
  const wallet = params.wallet.toLowerCase();
  const seller = params.seller.toLowerCase();
  const amount = Number(params.amountUsd);

  if (!isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  // Seller allow/blocklist.
  const allow = list("BUY_SELLER_ALLOWLIST");
  const block = list("BUY_SELLER_BLOCKLIST");
  if (block.includes(seller)) {
    return { ok: false, error: "seller_blocked", detail: "This seller is on the blocklist." };
  }
  if (allow.length > 0 && !allow.includes(seller)) {
    return { ok: false, error: "seller_not_allowlisted", detail: "This seller is not on the allowlist." };
  }

  // Per-transaction cap.
  if (amount > MAX_PER_TX) {
    return {
      ok: false,
      error: "exceeds_per_tx_limit",
      detail: `Single purchase ${amount} USDC exceeds the ${MAX_PER_TX} USDC per-transaction limit.`,
    };
  }

  // Rolling per-wallet window cap.
  const now = Date.now();
  const s = store();
  const cur = s.get(wallet);
  const entry: Spend = cur && cur.resetAt > now ? cur : { total: 0, resetAt: now + WINDOW_MS };
  if (entry.total + amount > WINDOW_CAP) {
    const remaining = Math.max(0, WINDOW_CAP - entry.total);
    return {
      ok: false,
      error: "exceeds_window_limit",
      detail: `Wallet spend limit reached (${WINDOW_CAP} USDC per ${Math.round(WINDOW_MS / 3_600_000)}h). ${remaining.toFixed(3)} USDC remaining.`,
    };
  }

  entry.total += amount;
  s.set(wallet, entry);
  return { ok: true };
}

/** Refund a reserved spend (e.g. when the transfer init fails after the check). */
export function refundSpend(wallet: string, amountUsd: string): void {
  const w = wallet.toLowerCase();
  const amount = Number(amountUsd);
  if (!isFinite(amount) || amount <= 0) return;
  const s = store();
  const cur = s.get(w);
  if (cur) cur.total = Math.max(0, cur.total - amount);
}

export const spendPolicyConfig = {
  maxPerTxUsd: MAX_PER_TX,
  windowCapUsd: WINDOW_CAP,
  windowMs: WINDOW_MS,
};
