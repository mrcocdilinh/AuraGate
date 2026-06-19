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
  endpoint: string;
  sampleResponse: unknown;
  active: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  serviceSlug: string;
  buyerAddress: string;
  amount: string;
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
  amount: string;
  resultHash: string;
  rating?: number;
  onchainTx?: string;
  blockNumber?: number;
  createdAt: string;
}