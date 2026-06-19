/**
 * Server-side helpers for Circle User-Controlled Wallets using the real
 * "Social logins & Email OTP" (PIN-less) flow.
 *
 * Docs: https://developers.circle.com/w3s/social-and-email-login
 *
 * Flow overview (the client SDK drives the UI; these endpoints mint the
 * short-lived device tokens the SDK needs and create the wallet afterwards):
 *
 *   Email OTP:  client.getDeviceId() ─▶ createDeviceTokenForEmailLogin
 *               ─▶ sdk.verifyOtp() ─▶ userToken ─▶ createWallet
 *   Google:     client.getDeviceId() ─▶ createDeviceTokenForSocialLogin
 *               ─▶ sdk.performLogin(GOOGLE) ─▶ userToken ─▶ createWallet
 *
 * When CIRCLE_API_KEY + NEXT_PUBLIC_CIRCLE_APP_ID are unset the helpers report
 * `demo: true` so local dev works without a Circle account.
 */

const API_KEY = process.env.CIRCLE_API_KEY ?? "";
export const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? "";

/** ARC-TESTNET is the Circle blockchain id for Arc Testnet. */
const WALLET_BLOCKCHAIN = "ARC-TESTNET";

export function circleConfigured(): boolean {
  return Boolean(API_KEY && CIRCLE_APP_ID);
}

async function client() {
  const { initiateUserControlledWalletsClient } = await import(
    "@circle-fin/user-controlled-wallets"
  );
  return initiateUserControlledWalletsClient({ apiKey: API_KEY });
}

export interface EmailDeviceToken {
  deviceToken: string;
  deviceEncryptionKey: string;
  otpToken: string;
  demo: boolean;
}

/**
 * Mint a device token for Email OTP login. Circle also sends the OTP email to
 * `email` (using the SMTP provider configured in the Circle console).
 */
export async function createEmailDeviceToken(
  deviceId: string,
  email: string
): Promise<EmailDeviceToken> {
  if (!circleConfigured()) {
    return { deviceToken: "", deviceEncryptionKey: "", otpToken: "", demo: true };
  }
  const c = await client();
  const res = await c.createDeviceTokenForEmailLogin({ deviceId, email });
  return {
    deviceToken: res.data?.deviceToken ?? "",
    deviceEncryptionKey: res.data?.deviceEncryptionKey ?? "",
    otpToken: res.data?.otpToken ?? "",
    demo: false,
  };
}

export interface SocialDeviceToken {
  deviceToken: string;
  deviceEncryptionKey: string;
  demo: boolean;
}

/** Mint a device token for social (Google) login. */
export async function createSocialDeviceToken(
  deviceId: string
): Promise<SocialDeviceToken> {
  if (!circleConfigured()) {
    return { deviceToken: "", deviceEncryptionKey: "", demo: true };
  }
  const c = await client();
  const res = await c.createDeviceTokenForSocialLogin({ deviceId });
  return {
    deviceToken: res.data?.deviceToken ?? "",
    deviceEncryptionKey: res.data?.deviceEncryptionKey ?? "",
    demo: false,
  };
}

/**
 * Create an Arc wallet for a freshly-authenticated user. Returns a challengeId
 * the client SDK executes to finalise creation (no PIN for social/email users).
 * Returns `{exists: true}` when the user already has a wallet (409 from Circle).
 */
export async function createWalletChallenge(
  userToken: string
): Promise<{ challengeId?: string; exists?: boolean; demo: boolean }> {
  if (!circleConfigured()) return { demo: true };
  const c = await client();
  try {
    const res = await c.createWallet({
      userToken,
      blockchains: [WALLET_BLOCKCHAIN as never],
    });
    return { challengeId: res.data?.challengeId, demo: false };
  } catch (e: unknown) {
    // Circle returns 409 when the user already has a wallet on this blockchain.
    const status =
      (e as { response?: { status?: number } })?.response?.status;
    if (status === 409) return { exists: true, demo: false };
    throw e;
  }
}

/** Look up the user's Arc wallet address (after creation completes). */
export async function getUserWalletAddress(
  userToken: string
): Promise<string | null> {
  if (!circleConfigured()) return null;
  const c = await client();
  try {
    const res = await c.listWallets({ userToken } as never);
    // TrimDataResponse strips one .data layer; the SDK type uses a nested data.wallets
    // structure, so both access paths are tried for forward compatibility.
    const rawData = res.data as
      | { wallets?: Array<{ blockchain?: string; address?: string }> }
      | undefined;
    const wallets = rawData?.wallets ?? [];
    const arc =
      wallets.find((w) => w.blockchain === WALLET_BLOCKCHAIN && w.address) ??
      wallets.find((w) => w.address);
    return arc?.address ?? null;
  } catch {
    return null;
  }
}
