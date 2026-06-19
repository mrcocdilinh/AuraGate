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

// Always use a fresh SDK instance for execute() so stale OAuth session state
// from the login SDK doesn't cause "Invalid credentials" on challenge execution.
async function executeChallenge(challengeId: string): Promise<void> {
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const sdk = new W3SSdk({ appSettings: { appId: PUBLIC_APP_ID } });
  return new Promise<void>((resolve, reject) => {
    sdk.execute(challengeId, (error: { message: string } | undefined) => {
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

/**
 * After a successful login (userToken in hand), make sure the user has an Arc
 * wallet and return its address. Creates the wallet via an SDK challenge when
 * the user is brand new.
 */
export async function ensureWalletAddress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _sdk: any,
  userToken: string
): Promise<string | null> {
  // Returning user — wallet already exists.
  const existing = await fetchAddress(userToken);
  if (existing) return existing;

  // New user — create the wallet, then execute the challenge.
  const init = await fetch("/api/wallet/create-wallet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userToken }),
  })
    .then((r) => r.json())
    .catch(() => null);

  if (init?.error) {
    console.error("[ensureWalletAddress] createWallet failed:", init.error, init.detail ?? "");

    // PIN-based Circle App: user hasn't set up a PIN yet.
    // createUserPinWithWallets sets PIN + creates ARC-TESTNET wallet in one step.
    const needsPin = (init.detail as string | undefined)?.toLowerCase().includes("pin");
    if (!needsPin) return null;

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
      await executeChallenge(pinInit.challengeId);
    } catch (e) {
      console.error("[ensureWalletAddress] PIN setup failed:", e);
      return null;
    }

    // Wallet creation is async — poll after PIN setup.
    for (let i = 0; i < 6; i++) {
      await sleep(1500);
      const addr = await fetchAddress(userToken);
      if (addr) return addr;
    }
    return null;
  }

  if (init?.challengeId) {
    try {
      await executeChallenge(init.challengeId);
    } catch (e) {
      console.error("[ensureWalletAddress] wallet challenge failed:", e);
    }
  }

  // Wallet creation settles asynchronously — poll for the address.
  for (let i = 0; i < 6; i++) {
    await sleep(1500);
    const addr = await fetchAddress(userToken);
    if (addr) return addr;
  }
  return null;
}
