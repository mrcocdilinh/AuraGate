import { getAddress, isAddress, verifyMessage } from "viem";
import { getUserWalletAddress } from "./circle";

const WINDOW_MS = 10 * 60_000;
const g = globalThis as unknown as { __agOwnerNonces?: Map<string, number> };

function usedNonces(): Map<string, number> {
  if (!g.__agOwnerNonces) g.__agOwnerNonces = new Map();
  return g.__agOwnerNonces;
}

function consumeNonce(key: string): boolean {
  const now = Date.now();
  for (const [k, expires] of usedNonces()) {
    if (expires <= now) usedNonces().delete(k);
  }
  if (usedNonces().has(key)) return false;
  usedNonces().set(key, now + WINDOW_MS);
  return true;
}

export interface OwnerAuthBody {
  userToken?: unknown;
  ownerAddress?: unknown;
  ownerSignature?: unknown;
  ownerMessage?: unknown;
}

export interface OwnerAction {
  action: string;
  subject: string;
  ownerAddress: string;
  nonce: string;
  issuedAt: string;
  extra?: Record<string, string | number | boolean | null | undefined>;
}

export function buildOwnerActionMessage(input: OwnerAction): string {
  const extra = input.extra
    ? Object.entries(input.extra)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${String(v)}`)
        .join("\n")
    : "";
  return [
    "AuraGate ownership action",
    `action:${input.action}`,
    `subject:${input.subject}`,
    `owner:${getAddress(input.ownerAddress)}`,
    `nonce:${input.nonce}`,
    `issuedAt:${input.issuedAt}`,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

function isFresh(issuedAt: string): boolean {
  const ts = Date.parse(issuedAt);
  return Number.isFinite(ts) && Math.abs(Date.now() - ts) <= WINDOW_MS;
}

function normalizeAddress(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return isAddress(raw) ? getAddress(raw) : null;
}

export async function authorizeOwner(params: {
  body: OwnerAuthBody;
  expectedAddress: string;
  action: string;
  subject: string;
  extra?: OwnerAction["extra"];
}): Promise<{ ok: true; address: string; method: "circle" | "signature" } | { ok: false; error: string }> {
  const expected = normalizeAddress(params.expectedAddress);
  if (!expected) return { ok: false, error: "invalid_expected_owner" };

  const userToken = typeof params.body.userToken === "string" ? params.body.userToken : "";
  if (userToken) {
    const address = await getUserWalletAddress(userToken);
    const normalized = normalizeAddress(address);
    if (normalized && normalized.toLowerCase() === expected.toLowerCase()) {
      return { ok: true, address: normalized, method: "circle" };
    }
    return { ok: false, error: "circle_owner_mismatch" };
  }

  const ownerAddress = normalizeAddress(params.body.ownerAddress);
  const ownerSignature =
    typeof params.body.ownerSignature === "string" ? params.body.ownerSignature : "";
  const ownerMessage =
    typeof params.body.ownerMessage === "string" ? params.body.ownerMessage : "";

  if (ownerAddress && ownerSignature && ownerMessage) {
    if (ownerAddress.toLowerCase() !== expected.toLowerCase()) {
      return { ok: false, error: "signature_owner_mismatch" };
    }

    const nonce = ownerMessage.match(/^nonce:(.+)$/m)?.[1]?.trim() ?? "";
    const issuedAt = ownerMessage.match(/^issuedAt:(.+)$/m)?.[1]?.trim() ?? "";
    if (!nonce || !issuedAt || !isFresh(issuedAt)) {
      return { ok: false, error: "signature_expired_or_malformed" };
    }

    const expectedMessage = buildOwnerActionMessage({
      action: params.action,
      subject: params.subject,
      ownerAddress,
      nonce,
      issuedAt,
      extra: params.extra,
    });
    if (ownerMessage !== expectedMessage) {
      return { ok: false, error: "signature_message_mismatch" };
    }

    const valid = await verifyMessage({
      address: ownerAddress as `0x${string}`,
      message: ownerMessage,
      signature: ownerSignature as `0x${string}`,
    });
    if (valid) {
      const nonceKey = `${ownerAddress}:${params.action}:${params.subject}:${nonce}`;
      if (!consumeNonce(nonceKey)) return { ok: false, error: "signature_nonce_replayed" };
      return { ok: true, address: ownerAddress, method: "signature" };
    }
  }

  if (process.env.ALLOW_UNVERIFIED_OWNER_ACTIONS === "true") {
    return { ok: true, address: expected, method: "signature" };
  }

  return { ok: false, error: "owner_authorization_required" };
}
