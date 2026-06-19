import { ARC } from "./arc";

/**
 * x402 payment layer for AuraGate sellers.
 *
 * Two modes (env X402_MODE):
 *  - "mock" (default): no Circle Gateway needed. Returns a spec-shaped 402
 *    challenge and accepts any signed X-PAYMENT header so the marketplace is
 *    fully demoable locally.
 *  - "live": uses the real Circle Gateway testnet facilitator via
 *    `@circle-fin/x402-batching` to verify + settle the payment.
 */

const MODE = (process.env.X402_MODE ?? "mock").toLowerCase();
const SELLER_ADDRESS =
  process.env.SELLER_ADDRESS ?? "0x0000000000000000000000000000000000000000";
const FACILITATOR_URL =
  process.env.GATEWAY_FACILITATOR_URL ?? "https://gateway-api-testnet.circle.com";

export const X402_VERSION = 2;

/** USD dollars -> USDC atomic units (6 decimals) as a string */
export function toAtomicUSDC(price: string): string {
  const n = Number(price);
  return Math.round(n * 1_000_000).toString();
}

export interface PaymentResult {
  paid: boolean;
  payer: string;
  amount: string; // USD dollars
  network: string;
  transaction?: string;
}

/** The x402 402-challenge body advertised to agents. */
export function buildChallenge(price: string, payTo = SELLER_ADDRESS) {
  return {
    x402Version: X402_VERSION,
    accepts: [
      {
        scheme: "exact",
        network: ARC.caip2,
        asset: ARC.usdcAddress,
        amount: toAtomicUSDC(price),
        payTo,
        maxTimeoutSeconds: 60,
        extra: { name: "USDC", version: "2" },
      },
    ],
    error: "Payment required",
  };
}

function decodePaymentHeader(header: string): unknown {
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    try {
      return JSON.parse(header);
    } catch {
      return header;
    }
  }
}

/**
 * Verify (and in live mode, settle) payment for a protected request.
 * Returns null when payment is missing/invalid — caller should respond 402.
 */
export async function settlePayment(
  req: Request,
  price: string,
  payTo = SELLER_ADDRESS
): Promise<PaymentResult | null> {
  const header = req.headers.get("x-payment");
  if (!header) return null;

  if (MODE !== "live") {
    // Mock: accept the signed header, echo a payer if provided.
    const payer = req.headers.get("x-payer") ?? "0xA9e7000000000000000000000000000000000Bob";
    return { paid: true, payer, amount: price, network: ARC.caip2 };
  }

  // Live: use Circle Gateway facilitator to verify + settle.
  const { createGatewayMiddleware } = await import(
    "@circle-fin/x402-batching/server"
  );
  const gateway = createGatewayMiddleware({
    sellerAddress: payTo,
    networks: [ARC.caip2],
    facilitatorUrl: FACILITATOR_URL,
  });
  const payment = decodePaymentHeader(header);

  const verified = await gateway.verify(payment);
  if (!verified.valid) return null;

  const settled = await gateway.settle(payment);
  if (!settled.success) return null;

  return {
    paid: true,
    payer: verified.payer ?? settled.transaction ?? "unknown",
    amount: price,
    network: ARC.caip2,
    transaction: settled.transaction,
  };
}

export const x402Info = {
  mode: MODE,
  sellerAddress: SELLER_ADDRESS,
  facilitatorUrl: FACILITATOR_URL,
};