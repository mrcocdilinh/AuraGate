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

/** Deterministic demo address from a string (no real key — demo mode only). */
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

    const userId = email ?? `google-${Date.now()}`;

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

      const addrRes = await fetch("/api/wallet/address", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userToken: tokenRes.userToken }),
      }).then((r) => r.json());

      persist({
        status: "connected",
        address: addrRes.address ?? demoAddress(userId),
        email,
        method,
        demo: false,
      });
    } catch {
      const addrRes = await fetch("/api/wallet/address", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userToken: tokenRes.userToken }),
      })
        .then((r) => r.json())
        .catch(() => null);

      if (addrRes?.address) {
        persist({
          status: "connected",
          address: addrRes.address,
          email,
          method,
          demo: false,
        });
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
