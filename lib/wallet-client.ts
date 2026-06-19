/**
 * Client-side helpers shared by the wallet provider (email OTP, in-page) and
 * the /auth/callback page (Google, post-redirect). Keeps the Circle SDK plumbing
 * in one place so both entry points produce an identical connected wallet.
 */

export type LoginMethod = "email" | "google";

export interface StoredWallet {
  status: "connected";
  address: string;
  email?: string;
  method: LoginMethod;
  demo: boolean;
}

// localStorage / sessionStorage keys
export const WALLET_KEY = "auragate.wallet";
export const PENDING_GOOGLE_KEY = "auragate.pending-google";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Public config the browser is allowed to see.
export const PUBLIC_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? "";
export const PUBLIC_GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Whether real Circle wallets are wired up (vs. local demo mode). */
export function circleReady(): boolean {
  return Boolean(PUBLIC_APP_ID);
}

export function googleReady(): boolean {
  return Boolean(PUBLIC_APP_ID && PUBLIC_GOOGLE_CLIENT_ID);
}

export function googleRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

/** Deterministic demo address (no key — local demo mode only). */
export function demoAddress(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let out = "";
  let s = h >>> 0;
  for (let i = 0; i < 40; i++) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    out += (s % 16).toString(16);
  }
  return `0x${out}`;
}

export function saveWallet(w: StoredWallet) {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(w));
  } catch {
    /* ignore */
  }
}

export function clearWallet() {
  try {
    localStorage.removeItem(WALLET_KEY);
  } catch {
    /* ignore */
  }
}

export function loadWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    return raw ? (JSON.parse(raw) as StoredWallet) : null;
  } catch {
    return null;
  }
}

async function fetchAddress(userToken: string): Promise<string | null> {
  try {
    const res = await fetch("/api/wallet/address", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userToken }),
    }).then((r) => r.json());
    return res?.address ?? null;
  } catch {
    return null;
  }
}

/**
 * Run a Circle challenge (PIN setup, wallet creation, etc.) to completion on
 * the SAME W3SSdk instance that performed the login.
 *
 * Why reuse the login SDK rather than `new W3SSdk()`:
 *  - W3SSdk is a singleton (`if (W3SSdk.instance != null) return instance`),
 *    so `new W3SSdk()` returns the existing instance anyway — but it first
 *    re-runs setupInstance(), which overwrites `this.configs` (losing auth)
 *    and re-triggers execSocialLoginStatusCheck() (re-processing the OAuth
 *    hash). Reusing the instance avoids those side effects.
 *
 * We only need to attach credentials before executing:
 *  - setAuthentication({ userToken, encryptionKey }) where encryptionKey is the
 *    one returned in the LOGIN RESULT (SocialLoginResult.encryptionKey), NOT the
 *    deviceEncryptionKey from the device-token step — the wrong one yields
 *    error 155118 (invalidEncryptionKey).
 */
async function executeChallenge(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any,
  challengeId: string,
  userToken: string,
  encryptionKey: string
): Promise<void> {
  sdk.setAuthentication({ userToken, encryptionKey });
  return new Promise<void>((resolve, reject) => {
    sdk.execute(
      challengeId,
      (error: { code?: number; message: string } | undefined) => {
        if (error) {
          console.error("[executeChallenge] failed:", error.code, error.message);
          reject(new Error(`${error.code ?? "?"}: ${error.message}`));
        } else {
          resolve();
        }
      }
    );
  });
}

export interface EnsureWalletResult {
  address: string | null;
  /** Human-readable reason when address is null (shown on-screen for diagnosis). */
  error?: string;
}

/**
 * After a successful login, ensure the user has an Arc wallet and return its
 * address. For new users on a PIN-based Circle App, this triggers the PIN
 * setup modal (which also creates the ARC-TESTNET wallet in one challenge).
 *
 * @param sdk            The W3SSdk instance used to log in (reused for the
 *                       challenge — it is a singleton).
 * @param userToken      Circle user token from the login result.
 * @param encryptionKey  SocialLoginResult/EmailLoginResult `encryptionKey`
 *                       (NOT deviceEncryptionKey). Required to run challenges.
 * @param onProgress     Optional callback for live status (surfaced in the UI).
 */
export async function ensureWalletAddress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any,
  userToken: string,
  encryptionKey: string,
  onProgress?: (msg: string) => void
): Promise<EnsureWalletResult> {
  const progress = (m: string) => {
    console.log("[ensureWalletAddress]", m);
    onProgress?.(m);
  };

  // Returning user — wallet already exists.
  progress("Checking for existing wallet…");
  const existing = await fetchAddress(userToken);
  if (existing) return { address: existing };

  // New user — try to create the wallet directly.
  progress("Creating your Arc wallet…");
  const init = await fetch("/api/wallet/create-wallet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userToken }),
  })
    .then((r) => r.json())
    .catch(() => null);

  // PIN-based Circle App: createWallet fails until the user sets a PIN.
  // init-pin's createUserPinWithWallets sets the PIN AND creates the wallet
  // in a single challenge.
  if (init?.error) {
    const detail = (init.detail as string | undefined) ?? "";
    const needsPin = detail.toLowerCase().includes("pin");
    if (!needsPin) {
      return { address: null, error: `create-wallet: ${init.error} ${detail}` };
    }

    progress("Preparing PIN setup…");
    const pinInit = await fetch("/api/wallet/init-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userToken }),
    })
      .then((r) => r.json())
      .catch(() => null);

    if (!pinInit?.challengeId) {
      return {
        address: null,
        error: `init-pin failed: ${pinInit?.detail ?? pinInit?.error ?? "no challengeId"}`,
      };
    }

    progress("Opening PIN setup — enter a 6-digit PIN…");
    try {
      await executeChallenge(sdk, pinInit.challengeId, userToken, encryptionKey);
    } catch (e) {
      return {
        address: null,
        error: `PIN setup: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  } else if (init?.challengeId) {
    // PIN-less app: a plain CREATE_WALLET challenge.
    progress("Finalizing wallet…");
    try {
      await executeChallenge(sdk, init.challengeId, userToken, encryptionKey);
    } catch (e) {
      return {
        address: null,
        error: `wallet challenge: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // Wallet creation settles asynchronously — poll for the address.
  progress("Confirming wallet on Arc…");
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const addr = await fetchAddress(userToken);
    if (addr) return { address: addr };
  }
  return { address: null, error: "Wallet not found after creation (timeout)" };
}
