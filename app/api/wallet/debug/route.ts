import { NextResponse } from "next/server";
import { circleConfigured, CIRCLE_APP_ID } from "@/lib/circle";

export const dynamic = "force-dynamic";

/** Debug endpoint — call Circle API with a dummy deviceId and return the raw error. */
export async function GET() {
  const configured = circleConfigured();
  const appId = CIRCLE_APP_ID;
  const apiKeyPreview = (process.env.CIRCLE_API_KEY ?? "").slice(0, 20) + "...";

  if (!configured) {
    return NextResponse.json({ configured: false, appId, apiKeyPreview });
  }

  try {
    const { initiateUserControlledWalletsClient } = await import(
      "@circle-fin/user-controlled-wallets"
    );
    const c = initiateUserControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY ?? "",
    });

    const res = await c.createDeviceTokenForEmailLogin({
      deviceId: "test-device-id-debug-12345678",
      email: "debug@auragate.app",
    });

    return NextResponse.json({ ok: true, data: res.data, appId });
  } catch (e: unknown) {
    const err = e as {
      response?: { data?: unknown; status?: number; headers?: unknown };
      message?: string;
      code?: string;
    };
    return NextResponse.json({
      ok: false,
      configured,
      appId,
      apiKeyPreview,
      status: err?.response?.status,
      responseData: err?.response?.data,
      message: err?.message,
      code: err?.code,
    });
  }
}
