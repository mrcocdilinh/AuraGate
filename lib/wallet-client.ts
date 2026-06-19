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
 * Run a Circle challenge (PIN setup, wallet creation, etc.) to completion.
 *
 * Uses a fresh W3SSdk instance with explicit setAuthentication() rather than
 * reusing the login SDK, because:
 *  - After a redirect-based Google OAuth login, the login SDK's postMessage
 *    subscription is in "login" mode and its execute() callback never fires.
 *  - A fresh instance gets clean event listeners.
 *  - setAuthentication({ userToken, encryptionKey }) supplies the credentials
 *    the challenge iframe needs. NOTE: encryptionKey here is the one returned
 *    in the LOGIN RESULT (SocialLoginResult.encryptionKey), NOT the
 *    deviceEncryptionKey from the device-token step — using the wrong one
 *    yields error 155118 (invalidEncryptionKey).
 */
async function executeChallenge(
  challengeId: string,
  userToken: string,
  encryptionKey: string
): Promise<void> {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const sdk = new W3SSdk({ appSettings: { appId: PUBLIC_APP_ID } });
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

/**
 * After a successful login, ensure the user has an Arc wallet and return its
 * address. For new users on a PIN-based Circle App, this triggers the PIN
 * setup modal (which also creates the ARC-TESTNET wallet in one challenge).
 *
 * @param userToken      Circle user token from the login result.
 * @param encryptionKey  SocialLoginResult/EmailLoginResult `encryptionKey`
 *                       (NOT deviceEncryptionKey). Required to run challenges.
 */
export async function ensureWalletAddress(
  userToken: string,
  encryptionKey: string
): Promise<string | null> {
  // Returning user — wallet already exists.
  const existing = await fetchAddress(userToken);
  if (existing) return existing;

  // New user — try to create the wallet directly.
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
    const needsPin = (init.detail as string | undefined)
      ?.toLowerCase()
      .includes("pin");
    if (!needsPin) {
      console.error("[ensureWalletAddress] createWallet failed:", init.error, init.detail ?? "");
      return null;
    }

    const pinInit = await fetch("/api/wallet/init-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userToken }),
    })
      .then((r) => r.json())
      .catch(() => null);

    if (!pinInit?.challengeId) {
      console.error("[ensureWalletAddress] init-pin failed:", pinInit);
      return null;
    }

    try {
      await executeChallenge(pinInit.challengeId, userToken, encryptionKey);
    } catch (e) {
      console.error("[ensureWalletAddress] PIN setup failed:", e);
      return null;
    }
  } else if (init?.challengeId) {
    // PIN-less app: a plain CREATE_WALLET challenge.
    try {
      await executeChallenge(init.challengeId, userToken, encryptionKey);
    } catch (e) {
      console.error("[ensureWalletAddress] wallet challenge failed:", e);
      return null;
    }
  }

  // Wallet creation settles asynchronously — poll for the address.
  for (let i = 0; i < 8; i++) {
    await sleep(1500);
    const addr = await fetchAddress(userToken);
    if (addr) return addr;
  }
  return null;
}
