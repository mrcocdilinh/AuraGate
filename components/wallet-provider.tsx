"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type LoginMethod,
  type StoredWallet,
  PENDING_GOOGLE_KEY,
  PUBLIC_APP_ID,
  PUBLIC_GOOGLE_CLIENT_ID,
  circleReady,
  googleReady,
  googleRedirectUri,
  demoAddress,
  ensureWalletAddress,
  saveWallet,
  clearWallet,
  loadWallet,
} from "@/lib/wallet-client";

type Status = "disconnected" | "connecting" | "connected";

interface WalletState {
  status: Status;
  address?: string;
  email?: string;
  method?: LoginMethod;
  demo: boolean;
  error?: string;
}

interface WalletCtx extends WalletState {
  loginWithEmail: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    status: "disconnected",
    demo: !circleReady(),
  });

  // Restore a previously connected wallet on mount (incl. after Google redirect,
  // where /auth/callback wrote the wallet to localStorage before returning here).
  useEffect(() => {
    const w = loadWallet();
    if (w) setState({ ...w, status: "connected" });
  }, []);

  const persist = (s: WalletState) => {
    setState(s);
    if (s.status === "connected" && s.address) {
      saveWallet({
        status: "connected",
        address: s.address,
        email: s.email,
        method: s.method!,
        demo: s.demo,
      } satisfies StoredWallet);
    } else if (s.status === "disconnected") {
      clearWallet();
    }
  };

  // ── Email OTP login (in-page modal, no redirect) ────────────────────────────
  const loginWithEmail = useCallback(async (email: string) => {
    setState({ status: "connecting", demo: !circleReady() });

    // Demo mode — no Circle configured.
    if (!circleReady()) {
      persist({
        status: "connected",
        address: demoAddress(email),
        email,
        method: "email",
        demo: true,
      });
      return;
    }

    try {
      const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new W3SSdk({ appSettings: { appId: PUBLIC_APP_ID } });
      const deviceId = await sdk.getDeviceId();

      const tok = await fetch("/api/wallet/email-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId, email }),
      }).then((r) => r.json());

      // Server returned an API error (Circle unreachable, bad key, etc.).
      if (tok.error && !tok.demo) {
        const detail = tok.detail ? `: ${tok.detail}` : "";
        setState({
          status: "disconnected",
          demo: false,
          error: `Circle error: ${tok.error}${detail}`,
        });
        return;
      }

      // No Circle credentials configured — fall into demo mode.
      if (tok.demo || !tok.deviceToken) {
        persist({
          status: "connected",
          address: demoAddress(email),
          email,
          method: "email",
          demo: true,
        });
        return;
      }

      sdk.updateConfigs(
        {
          appSettings: { appId: PUBLIC_APP_ID },
          loginConfigs: {
            deviceToken: tok.deviceToken,
            deviceEncryptionKey: tok.deviceEncryptionKey,
            otpToken: tok.otpToken,
          },
        },
        async (error, result) => {
          if (error || !result) {
            setState({
              status: "disconnected",
              demo: !circleReady(),
              error: error?.message ?? "Login cancelled",
            });
            return;
          }
          const address = await ensureWalletAddress(sdk, result.userToken);
          persist({
            status: "connected",
            address: address ?? demoAddress(email),
            email,
            method: "email",
            demo: !address,
          });
        }
      );

      // Opens the Circle OTP entry modal; the callback above resolves the rest.
      sdk.verifyOtp();
    } catch (e) {
      setState({
        status: "disconnected",
        demo: !circleReady(),
        error: e instanceof Error ? e.message : "Email login failed",
      });
    }
  }, []);

  // ── Google login (full-page redirect → /auth/callback) ──────────────────────
  const loginWithGoogle = useCallback(async () => {
    setState({ status: "connecting", demo: !circleReady() });

    // Demo / not-configured fallback.
    if (!googleReady()) {
      const seed = `google-${Date.now()}`;
      persist({
        status: "connected",
        address: demoAddress(seed),
        method: "google",
        demo: true,
      });
      return;
    }

    try {
      const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
      const sdk = new W3SSdk({ appSettings: { appId: PUBLIC_APP_ID } });
      const deviceId = await sdk.getDeviceId();

      const tok = await fetch("/api/wallet/social-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId }),
      }).then((r) => r.json());

      // Server returned an API error (Circle unreachable, bad key, etc.).
      if (tok.error && !tok.demo) {
        const detail = tok.detail ? `: ${tok.detail}` : "";
        setState({
          status: "disconnected",
          demo: false,
          error: `Circle error: ${tok.error}${detail}`,
        });
        return;
      }

      // No Circle credentials configured — fall into demo mode.
      if (tok.demo || !tok.deviceToken) {
        const seed = `google-${Date.now()}`;
        persist({
          status: "connected",
          address: demoAddress(seed),
          method: "google",
          demo: true,
        });
        return;
      }

      // The redirect loses in-memory state, so stash what /auth/callback needs.
      sessionStorage.setItem(
        PENDING_GOOGLE_KEY,
        JSON.stringify({
          deviceToken: tok.deviceToken,
          deviceEncryptionKey: tok.deviceEncryptionKey,
          returnPath: window.location.pathname + window.location.search,
        })
      );

      sdk.updateConfigs({
        appSettings: { appId: PUBLIC_APP_ID },
        loginConfigs: {
          deviceToken: tok.deviceToken,
          deviceEncryptionKey: tok.deviceEncryptionKey,
          google: {
            clientId: PUBLIC_GOOGLE_CLIENT_ID,
            redirectUri: googleRedirectUri(),
            selectAccountPrompt: true,
          },
        },
      });

      // Redirects to Google's account picker; resumes on /auth/callback.
      await sdk.performLogin("Google" as never);
    } catch (e) {
      sessionStorage.removeItem(PENDING_GOOGLE_KEY);
      setState({
        status: "disconnected",
        demo: !circleReady(),
        error: e instanceof Error ? e.message : "Google login failed",
      });
    }
  }, []);

  const logout = useCallback(() => {
    persist({ status: "disconnected", demo: !circleReady() });
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
