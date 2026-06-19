"use client";

import { useEffect, useRef, useState } from "react";
import {
  PENDING_GOOGLE_KEY,
  PUBLIC_APP_ID,
  PUBLIC_GOOGLE_CLIENT_ID,
  demoAddress,
  ensureWalletAddress,
  saveWallet,
} from "@/lib/wallet-client";

type Phase = "verifying" | "creating" | "done" | "error";

export default function GoogleCallbackPage() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState("Completing sign-in…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const finish = (path: string) => {
      // Full reload so WalletProvider re-reads the wallet from localStorage.
      window.location.assign(path);
    };

    const fail = (msg: string) => {
      setPhase("error");
      setMessage(msg);
      setTimeout(() => finish("/"), 2500);
    };

    let pending: { deviceToken: string; deviceEncryptionKey: string; returnPath: string };
    try {
      const raw = sessionStorage.getItem(PENDING_GOOGLE_KEY);
      if (!raw) {
        fail("Sign-in session expired. Redirecting…");
        return;
      }
      pending = JSON.parse(raw);
    } catch {
      fail("Could not read sign-in session. Redirecting…");
      return;
    }

    (async () => {
      try {
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

        // Re-create the SDK with the same login configs + a completion callback.
        // setupInstance() auto-detects the Google token in window.location.hash
        // and verifies it via Circle, then fires this callback.
        const sdk = new W3SSdk(
          {
            appSettings: { appId: PUBLIC_APP_ID },
            loginConfigs: {
              deviceToken: pending.deviceToken,
              deviceEncryptionKey: pending.deviceEncryptionKey,
              google: {
                clientId: PUBLIC_GOOGLE_CLIENT_ID,
                redirectUri: `${window.location.origin}/auth/callback`,
              },
            },
          },
          async (error, result) => {
            sessionStorage.removeItem(PENDING_GOOGLE_KEY);
            if (error || !result) {
              fail(error?.message ?? "Google sign-in failed. Redirecting…");
              return;
            }

            const email =
              "oAuthInfo" in result
                ? result.oAuthInfo?.socialUserInfo?.email
                : undefined;

            setPhase("creating");
            setMessage("Setting up your Arc wallet…");

            const address = await ensureWalletAddress(sdk, result.userToken);
            saveWallet({
              status: "connected",
              address: address ?? demoAddress(result.userToken),
              email,
              method: "google",
              demo: !address,
            });

            setPhase("done");
            setMessage("Signed in! Redirecting…");
            finish(pending.returnPath || "/");
          }
        );

        // Touch the instance so TS keeps the reference; hash processing is
        // kicked off inside the constructor's setupInstance().
        void sdk;
      } catch (e) {
        sessionStorage.removeItem(PENDING_GOOGLE_KEY);
        fail(
          e instanceof Error
            ? `${e.message}. Redirecting…`
            : "Sign-in failed. Redirecting…"
        );
      }
    })();
  }, []);

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-10">
      <div className="card flex flex-col items-center gap-4 p-10 text-center">
        {phase !== "error" ? (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-danger/15 text-danger">
            !
          </span>
        )}
        <div>
          <p className="font-semibold">
            {phase === "error" ? "Sign-in problem" : "Connecting your wallet"}
          </p>
          <p className="mt-1 text-sm text-muted">{message}</p>
        </div>
      </div>
    </div>
  );
}
