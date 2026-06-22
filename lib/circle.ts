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

import { ARC } from "./arc";

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
  const w = await getUserArcWallet(userToken);
  return w?.address ?? null;
}

interface ArcWallet {
  id: string;
  address: string;
}

/** Find the user's Arc wallet (id + address). Null if none / not configured. */
export async function getUserArcWallet(
  userToken: string
): Promise<ArcWallet | null> {
  if (!circleConfigured()) return null;
  const c = await client();
  try {
    const res = await c.listWallets({ userToken } as never);
    const rawData = res.data as
      | { wallets?: Array<{ id?: string; blockchain?: string; address?: string }> }
      | undefined;
    const wallets = rawData?.wallets ?? [];
    const arc =
      wallets.find((w) => w.blockchain === WALLET_BLOCKCHAIN && w.address) ??
      wallets.find((w) => w.address);
    return arc?.id && arc.address ? { id: arc.id, address: arc.address } : null;
  } catch {
    return null;
  }
}

export interface WithdrawInit {
  /** Client SDK executes this to authorize the transfer (PIN-less for social). */
  challengeId?: string;
  error?: string;
  detail?: string;
}

/**
 * Start a USDC withdrawal (transfer out) from the user's Arc wallet to an
 * external address. Returns a `challengeId` the client SDK executes to sign
 * and broadcast — no PIN for social/email (PIN-less) users.
 *
 * Steps: find the Arc wallet → resolve the USDC token id on that wallet →
 * createTransaction. Amount is a human USDC string (e.g. "1.50").
 */
export async function initUsdcWithdrawal(params: {
  userToken: string;
  destinationAddress: string;
  amount: string;
}): Promise<WithdrawInit> {
  if (!circleConfigured()) return { error: "circle_not_configured" };
  const usdc = ARC.usdcAddress;
  if (!/^0x[a-fA-F0-9]{40}$/.test(usdc) || /^0x0+$/.test(usdc)) {
    return { error: "usdc_not_configured", detail: "USDC address is not set" };
  }

  const c = await client();
  const wallet = await getUserArcWallet(params.userToken);
  if (!wallet) return { error: "no_wallet", detail: "No Arc wallet for this user" };

  // Resolve the Circle token id for USDC on this wallet.
  let tokenId = "";
  try {
    const bal = await c.getWalletTokenBalance({
      userToken: params.userToken,
      walletId: wallet.id,
      tokenAddresses: [usdc],
    } as never);
    const balances = (bal.data as { tokenBalances?: Array<{ token?: { id?: string } }> })
      ?.tokenBalances ?? [];
    tokenId = balances[0]?.token?.id ?? "";
  } catch {
    /* fall through to error below */
  }
  if (!tokenId) {
    return { error: "no_usdc_token", detail: "Wallet holds no USDC on Arc yet" };
  }

  try {
    const tx = await c.createTransaction({
      userToken: params.userToken,
      walletId: wallet.id,
      tokenId,
      destinationAddress: params.destinationAddress,
      amounts: [params.amount],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    } as never);
    const challengeId = (tx.data as { challengeId?: string })?.challengeId;
    if (!challengeId) return { error: "no_challenge", detail: "Circle returned no challengeId" };
    return { challengeId };
  } catch (e: unknown) {
    const detail =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      (e instanceof Error ? e.message : String(e));
    return { error: "transfer_failed", detail };
  }
}
