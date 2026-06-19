/**
 * Server-side helper for Circle User-Controlled Wallets (email / Google login).
 *
 * Docs: https://developers.circle.com/wallets/user-controlled
 *
 * When CIRCLE_API_KEY + NEXT_PUBLIC_CIRCLE_APP_ID are set, this talks to the
 * real Circle API. Otherwise it runs in "demo" mode so the UI is fully usable
 * without a Circle developer account.
 */

const API_KEY = process.env.CIRCLE_API_KEY ?? "";
export const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? "";

export function circleConfigured(): boolean {
  return Boolean(API_KEY && CIRCLE_APP_ID);
}

export interface SessionToken {
  userToken: string;
  encryptionKey: string;
  demo: boolean;
}

/** Create (or fetch) a user token used to drive the client-side Web SDK. */
export async function createSessionToken(userId: string): Promise<SessionToken> {
  if (!circleConfigured()) {
    return { userToken: `demo:${userId}`, encryptionKey: "demo", demo: true };
  }

  const { initiateUserControlledWalletsClient } = await import(
    "@circle-fin/user-controlled-wallets"
  );
  const client = initiateUserControlledWalletsClient({ apiKey: API_KEY });

  try {
    await client.createUser({ userId });
  } catch {
    // user already exists — ignore
  }
  const res = await client.createUserToken({ userId });
  return {
    userToken: res.data?.userToken ?? "",
    encryptionKey: res.data?.encryptionKey ?? "",
    demo: false,
  };
}

/** Kick off wallet creation; returns a challengeId the Web SDK resolves. */
export async function initializeWallet(userToken: string): Promise<{
  challengeId?: string;
  demo: boolean;
}> {
  if (!circleConfigured()) return { demo: true };

  const { initiateUserControlledWalletsClient } = await import(
    "@circle-fin/user-controlled-wallets"
  );
  const client = initiateUserControlledWalletsClient({ apiKey: API_KEY });
  const res = await client.createUserPinWithWallets({
    userToken,
    blockchains: ["ARC-TESTNET" as never],
  });
  return { challengeId: res.data?.challengeId, demo: false };
}

/** Get the Arc wallet address for a user (after wallet initialization). */
export async function getUserWalletAddress(
  userToken: string
): Promise<string | null> {
  if (!circleConfigured()) return null;

  const { initiateUserControlledWalletsClient } = await import(
    "@circle-fin/user-controlled-wallets"
  );
  const client = initiateUserControlledWalletsClient({ apiKey: API_KEY });
  try {
    const res = await client.listWallets({ userToken } as never);
    const wallets: Array<{ blockchain: string; address: string }> =
      (res.data as { wallets?: Array<{ blockchain: string; address: string }> })
        ?.wallets ?? [];
    const arc =
      wallets.find((w) => w.blockchain === "ARC-TESTNET") ?? wallets[0];
    return arc?.address ?? null;
  } catch {
    return null;
  }
}
