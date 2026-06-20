"use client";

import { useEffect, useRef, useState } from "react";
import {
  PIN_CHALLENGE_KEY,
  PUBLIC_APP_ID,
  demoAddress,
  saveWallet,
  sleep,
} from "@/lib/wallet-client";

type Phase = "loading" | "pin" | "confirming" | "done" | "error";

export default function SetupPinPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("Loading PIN setup…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const fail = (msg: string) => {
      setPhase("error");
      setMessage(msg);
    };

    (async () => {
      let stored: {
        challengeId: string;
        userToken: string;
        encryptionKey: string;
        email?: string;
        stableSeed: string;
        returnPath: string;
      };

      try {
        const raw = sessionStorage.getItem(PIN_CHALLENGE_KEY);
        if (!raw) { fail("PIN session expired. Please sign in again."); return; }
        stored = JSON.parse(raw);
        sessionStorage.removeItem(PIN_CHALLENGE_KEY);
      } catch {
        fail("Could not read PIN session. Please sign in again.");
        return;
      }

      if (!PUBLIC_APP_ID) {
        fail("Circle App ID not configured.");
        return;
      }

      try {
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

        // Fresh SDK instance — no loginConfigs, so execute() opens PIN iframe cleanly.
        const sdk = new W3SSdk({ appSettings: { appId: PUBLIC_APP_ID } });
        sdk.setAuthentication({
          userToken: stored.userToken,
          encryptionKey: stored.encryptionKey,
        });

        setPhase("pin");
        setMessage("Enter your 6-digit PIN…");

        await new Promise<void>((resolve, reject) => {
          sdk.execute(
            stored.challengeId,
            (error: { code?: number; message: string } | undefined) => {
              if (error) reject(new Error(`${error.code ?? "?"}: ${error.message}`));
              else resolve();
            }
          );
        });

        setPhase("confirming");
        setMessage("Confirming wallet on Arc…");

        // Poll for wallet address after PIN setup completes.
        let address: string | null = null;
        for (let i = 0; i < 10; i++) {
          await sleep(1500);
          const res = await fetch("/api/wallet/address", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userToken: stored.userToken }),
          }).then((r) => r.json()).catch(() => null);
          if (res?.address) { address = res.address; break; }
        }

        saveWallet({
          status: "connected",
          address: address ?? demoAddress(stored.stableSeed),
          email: stored.email,
          method: "google",
          demo: !address,
        });

        setPhase("done");
        setMessage("Wallet ready! Redirecting…");
        window.location.assign(stored.returnPath || "/");
      } catch (e) {
        fail(e instanceof Error ? e.message : "PIN setup failed. Please try again.");
      }
    })();
  }, []);

  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-10">
      <div className="card flex flex-col items-center gap-4 p-10 text-center">
        {phase === "error" ? (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-danger/15 text-danger">!</span>
        ) : phase === "done" ? (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-mint/15 text-mint">✓</span>
        ) : (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
        )}
        <div>
          <p className="font-semibold">
            {phase === "error" ? "Setup problem" : phase === "pin" ? "Set up your PIN" : "Setting up wallet"}
          </p>
          <p className="mt-1 text-sm text-muted">{message}</p>
        </div>
        {phase === "error" && (
          <a href="/" className="btn-primary mt-2 text-sm">Back to home</a>
        )}
      </div>
    </div>
  );
}
