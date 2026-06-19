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
    // user already exists
  }
  const res = await client.createUserToken({ userId });
  return {
    userToken: res.data?.userToken ?? "",
    encryptionKey: res.data?.encryptionKey ?? "",
    demo: false,
  };
}

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