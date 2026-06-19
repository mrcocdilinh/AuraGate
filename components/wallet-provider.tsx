"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Status = "disconnected" | "connecting" | "connected";
type LoginMethod = "email" | "google";

interface WalletState {
  status: Status;
  address?: string;
  email?: string;
  method?: LoginMethod;
  demo: boolean;
}

interface WalletCtx extends WalletState {
  loginWithEmail: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);

function demoAddress(seed: string): string {
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

const KEY = "auragate.wallet";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWalletAddress(userToken: string): Promise<string | null> {
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

/** Retry fetching wallet address up to `attempts` times, with delay between. */
async function fetchWalletAddressWithRetry(
  userToken: string,
  attempts = 4,
  delayMs = 1500
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(delayMs);
    const addr = await fetchWalletAddress(userToken);
    if (addr) return addr;
  }
  return null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    status: "disconnected",
    demo: true,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...JSON.parse(raw), status: "connected" });
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (s: WalletState) => {
    setState(s);
    try {
      if (s.status === "connected") localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };

  const connect = async (method: LoginMethod, email?: string) => {
    persist({ status: "connecting", demo: true });

    // For Google, use a stable userId stored in localStorage so the same
    // Circle user is reused across sessions.
    let userId: string;
    if (method === "google") {
      const stored = localStorage.getItem("auragate.google-uid");
      userId = stored ?? `google-${crypto.randomUUID()}`;
      localStorage.setItem("auragate.google-uid", userId);
    } else {
      userId = email!;
    }

    let tokenRes: {
      userToken: string;
      encryptionKey: string;
      appId: string;
      demo: boolean;
    };
    try {
      tokenRes = await fetch("/api/wallet/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      }).then((r) => r.json());
    } catch {
      persist({ status: "disconnected", demo: true });
      return;
    }

    if (tokenRes.demo) {
      persist({
        status: "connected",
        address: demoAddress(userId),
        email,
        method,
        demo: true,
      });
      return;
    }

    try {
      // --- Returning user: wallet already exists ---
      const existing = await fetchWalletAddress(tokenRes.userToken);
      if (existing) {
        persist({ status: "connected", address: existing, email, method, demo: false });
        return;
      }

      // --- New user: run PIN challenge to create wallet ---
      const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new W3SSdk();
      sdk.setAppSettings({ appId: tokenRes.appId });
      sdk.setAuthentication({
        userToken: tokenRes.userToken,
        encryptionKey: tokenRes.encryptionKey,
      });

      const initRes = await fetch("/api/wallet/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userToken: tokenRes.userToken }),
      }).then((r) => r.json());

      if (initRes.challengeId) {
        await new Promise<void>((resolve, reject) => {
          sdk.execute(initRes.challengeId, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // Circle needs a moment to finalise wallet creation after PIN is set
      await sleep(2000);

      // Retry fetching the new wallet address
      const address = await fetchWalletAddressWithRetry(tokenRes.userToken, 4, 1500);

      persist({
        status: "connected",
        address: address ?? demoAddress(userId),
        email,
        method,
        demo: !address,
      });
    } catch (e) {
      console.error("[wallet] connect error:", e);
      // Last-ditch attempt: maybe the wallet exists despite the error
      const addr = await fetchWalletAddress(tokenRes.userToken);
      if (addr) {
        persist({ status: "connected", address: addr, email, method, demo: false });
      } else {
        persist({ status: "disconnected", demo: true });
      }
    }
  };

  const loginWithEmail = useCallback(async (email: string) => {
    await connect("email", email);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await connect("google");
  }, []);

  const logout = useCallback(() => {
    persist({ status: "disconnected", demo: true });
  }, []);

  return (
    <Ctx.Provider value={{ ...state, loginWithEmail, loginWithGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used within WalletProvider");
  return c;
}
