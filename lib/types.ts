export type ServiceCategory =
  | "data"
  | "ai"
  | "oracle"
  | "compute"
  | "market-insight";

export interface Service {
  slug: string;
  name: string;
  description: string;
  category: ServiceCategory;
  sellerAddress: string;
  sellerName: string;
  /** Price per request, in USDC dollars, e.g. "0.01" */
  price: string;
  method: "GET" | "POST";
  /** Relative API path that is x402-protected, e.g. /api/premium/market-insight */
  endpoint: string;
  sampleResponse: unknown;
  active: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  serviceSlug: string;
  buyerAddress: string;
  amount: string; // USDC dollars
  status: "settled" | "pending" | "failed";
  txHash?: string;
  network: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  paymentId: string;
  serviceSlug: string;
  payer: string;
  amount: string; // USDC dollars
  resultHash: string; // keccak-style hash of the response body
  rating?: number; // 1..5
  onchainTx?: string;
  blockNumber?: number;
  createdAt: string;
}