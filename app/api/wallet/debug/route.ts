import { NextResponse } from "next/server";
import { circleConfigured, CIRCLE_APP_ID } from "@/lib/circle";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = circleConfigured();
  const appId = CIRCLE_APP_ID;
  const apiKeyPreview = (process.env.CIRCLE_API_KEY ?? "").slice(0, 20) + "...";

  if (!configured) {
    return NextResponse.json({ configured: false, appId, apiKeyPreview });
  }

  const { initiateUserControlledWalletsClient } = await import(
    "@circle-fin/user-controlled-wallets"
  );
  const c = initiateUserControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY ?? "",
  });

  const results: Record<string, unknown> = { configured, appId, apiKeyPreview };

  // Test 1: createDeviceTokenForEmailLogin (email OTP)
  try {
    const res = await c.createDeviceTokenForEmailLogin({
      deviceId: "debug-device-id-00000001",
      email: "debug@auragate.app",
    });
    results.emailToken = { ok: true, data: res.data };
  } catch (e: unknown) {
    const err = e as { response?: { data?: unknown; status?: number }; message?: string; code?: unknown };
    results.emailToken = {
      ok: false,
      status: err?.response?.status,
      responseData: err?.response?.data,
      message: err?.message,
      code: err?.code,
    };
  }

  // Test 2: createWallet with a fake userToken to see the error type
  try {
    const res = await c.createWallet({
      userToken: "debug-fake-user-token-00000001",
      blockchains: ["ARC-TESTNET" as never],
    });
    results.createWallet = { ok: true, data: res.data };
  } catch (e: unknown) {
    const err = e as { response?: { data?: unknown; status?: number }; message?: string; code?: unknown };
    results.createWallet = {
      ok: false,
      status: err?.response?.status,
      responseData: err?.response?.data,
      message: err?.message,
      code: err?.code,
    };
  }

  // Test 3: createUserPinWithWallets (PIN init + wallet creation for PIN-based apps)
  try {
    const rawC = c as unknown as {
      createUserPinWithWallets: (
        userToken: string,
        body: { idempotencyKey: string; blockchains: string[] }
      ) => Promise<{ data?: unknown }>;
    };
    const res = await rawC.createUserPinWithWallets(
      "debug-fake-user-token-00000001",
      { idempotencyKey: crypto.randomUUID(), blockchains: ["ARC-TESTNET"] }
    );
    results.initPin = { ok: true, data: res.data };
  } catch (e: unknown) {
    const err = e as { response?: { data?: unknown; status?: number }; message?: string; code?: unknown };
    results.initPin = {
      ok: false,
      status: err?.response?.status,
      responseData: err?.response?.data,
      message: err?.message,
      code: err?.code,
    };
  }

  return NextResponse.json(results);
}
