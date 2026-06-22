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
  price: string;
  method: "GET" | "POST";
  /** Call URL agents hit. Internal demo services use /api/premium/[slug]. */
  endpoint: string;
  /** Seller-hosted x402 endpoint (open registry). When set, agents call this. */
  externalUrl?: string;
  /** Optional docs / homepage link shown on the service page. */
  docsUrl?: string;
  /** Free-form discovery tags. */
  tags?: string[];
  sampleResponse: unknown;
  /** Endpoint passed a live 402 health-check at registration time. */
  verified?: boolean;
  active: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  serviceSlug: string;
  buyerAddress: string;
  sellerAddress?: string;
  amount: string;
  status: "settled" | "pending" | "failed";
  txHash?: string;
  network: string;
  asset?: string;
  mode?: "mock" | "testnet" | "mainnet";
  verifiedAt?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  paymentId: string;
  serviceSlug: string;
  payer: string;
  sellerAddress?: string;
  amount: string;
  resultHash: string;
  requestHash?: string;
  rating?: number;
  onchainTx?: string;
  blockNumber?: number;
  mode?: "mock" | "testnet" | "mainnet";
  settlementRef?: string;
  contractAddress?: string;
  createdAt: string;
}

/** Aggregated reputation for a seller (derived from services + receipts). */
export interface SellerStats {
  address: string;
  name: string;
  services: number;
  calls: number;
  revenue: number;
  avgRating: number | null;
  ratedCount: number;
  verifiedServices: number;
  /** 0–100 composite reputation score. */
  reputation: number;
  firstSeen: string;
}
