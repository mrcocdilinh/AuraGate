import { ARC } from "./arc";

const MODE = (process.env.X402_MODE ?? "mock").toLowerCase();
const SELLER_ADDRESS =
  process.env.SELLER_ADDRESS ?? "0x0000000000000000000000000000000000000000";
const FACILITATOR_URL =
  process.env.GATEWAY_FACILITATOR_URL ?? "https://gateway-api-testnet.circle.com";

export const X402_VERSION = 2;

export function toAtomicUSDC(price: string): string {
  const n = Number(price);
  return Math.round(n * 1_000_000).toString();
}

export interface PaymentResult {
  paid: boolean;
  payer: string;
  amount: string;
  network: string;
  transaction?: string;
}

/** Simple body challenge used in mock mode (browser TryService demo). */
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

/**
 * Outcome of processing an x402 payment for an App Router request.
 *  - `challenge`: payment is required — return `response` (402) as-is.
 *  - `paid`: payment settled — produce the data. `responseHeaders` carries the
 *    Gateway PAYMENT-RESPONSE header (live mode) to echo on the 200.
 */
export type X402Outcome =
  | { kind: "challenge"; response: Response }
  | { kind: "paid"; payment: PaymentResult; responseHeaders?: Record<string, string> };

/**
 * Process an x402 payment.
 *
 * Mock mode accepts any `x-payment`/`payment-signature` header (no funds move).
 * Live mode runs Circle's Gateway `require()` middleware — which emits the
 * `PAYMENT-REQUIRED` header the Gateway buyer client expects, then verifies +
 * settles real USDC on Arc — adapted from Express (req/res) to App Router.
 */
export async function processPayment(
  req: Request,
  price: string,
  payTo = SELLER_ADDRESS
): Promise<X402Outcome> {
  if (MODE !== "live") {
    const header =
      req.headers.get("payment-signature") ?? req.headers.get("x-payment");
    if (!header) {
      return {
        kind: "challenge",
        response: Response.json(buildChallenge(price, payTo), { status: 402 }),
      };
    }
    const payer =
      req.headers.get("x-payer") ??
      "0xA9e7000000000000000000000000000000000Bob";
    return {
      kind: "paid",
      payment: { paid: true, payer, amount: price, network: ARC.caip2 },
    };
  }

  // ── Live: adapt Circle's Express-style gateway middleware to App Router ──
  const { createGatewayMiddleware } = await import(
    "@circle-fin/x402-batching/server"
  );
  const gateway = createGatewayMiddleware({
    sellerAddress: payTo,
    networks: [ARC.caip2],
    facilitatorUrl: FACILITATOR_URL,
  });
  const middleware = gateway.require(`$${price}`);

  // Express-shim request: lowercase header bag + url/method, mutable `payment`.
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shimReq: any = {
    headers,
    url: new URL(req.url).pathname,
    method: req.method,
    payment: undefined,
  };

  // Express-shim response: capture status/headers/body; resolve on end() or next().
  let statusCode = 200;
  const resHeaders: Record<string, string> = {};
  let body = "";
  let nexted = false;

  await new Promise<void>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shimRes: any = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(c: number) {
        statusCode = c;
      },
      setHeader(name: string, value: string) {
        resHeaders[name] = value;
      },
      status(code: number) {
        statusCode = code;
        return shimRes;
      },
      json(data: unknown) {
        resHeaders["Content-Type"] = "application/json";
        body = JSON.stringify(data);
        resolve();
      },
      end(data?: string) {
        if (data) body = data;
        resolve();
      },
    };
    const next = () => {
      nexted = true;
      resolve();
    };
    Promise.resolve(middleware(shimReq, shimRes, next)).catch((e) => {
      statusCode = 500;
      body = JSON.stringify({ error: "payment_processing_error", message: String(e) });
      resolve();
    });
  });

  if (nexted && shimReq.payment) {
    const p = shimReq.payment;
    return {
      kind: "paid",
      payment: {
        paid: true,
        payer: p.payer,
        amount: price,
        network: p.network ?? ARC.caip2,
        transaction: p.transaction,
      },
      responseHeaders: resHeaders["PAYMENT-RESPONSE"]
        ? { "PAYMENT-RESPONSE": resHeaders["PAYMENT-RESPONSE"] }
        : undefined,
    };
  }

  // Surface the Gateway failure reason in the server log — the buyer client
  // only echoes `error`, swallowing the `reason` that explains *why*.
  if (statusCode >= 400) {
    console.error(`[x402 live] ${statusCode} from gateway.require:`, body || "(empty)");
  }

  return {
    kind: "challenge",
    response: new Response(body || "{}", { status: statusCode, headers: resHeaders }),
  };
}

export const x402Info = {
  mode: MODE,
  sellerAddress: SELLER_ADDRESS,
  facilitatorUrl: FACILITATOR_URL,
};
