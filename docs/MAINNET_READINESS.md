# AuraGate Mainnet Readiness Runbook

This runbook is the production checklist for moving AuraGate from testnet demo
to a controlled mainnet beta.

## Target architecture

Keep x402/Circle Gateway as the payment rail. Do not route USDC into the receipt
contract.

```text
Agent -> paid API -> 402 PAYMENT-REQUIRED
Agent -> signed payment -> API verifies/settles with Circle Gateway
Seller receives USDC at payTo
Backend records a V2 receipt on-chain
Agent receives data + receipt headers
```

The contract is an authenticated receipt registry, not escrow.

## Required environment

```env
X402_MODE=live
NEXT_PUBLIC_NETWORK_MODE=mainnet
NEXT_PUBLIC_SITE_URL=https://auragate.app

NEXT_PUBLIC_ARC_CHAIN_ID=<arc-mainnet-chain-id>
NEXT_PUBLIC_ARC_RPC_URL=<arc-mainnet-rpc-url>
NEXT_PUBLIC_ARC_EXPLORER=<arc-mainnet-explorer-url>
NEXT_PUBLIC_USDC_ADDRESS=<arc-mainnet-usdc-address>

GATEWAY_FACILITATOR_URL=<circle-mainnet-gateway-url>
SELLER_ADDRESS=<fallback-seller-wallet>

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

CIRCLE_API_KEY=...
NEXT_PUBLIC_CIRCLE_APP_ID=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...

DEPLOYER_PRIVATE_KEY=...
NEXT_PUBLIC_RECEIPT_REGISTRY=<ReceiptRegistryV2 address>
NEXT_PUBLIC_RECEIPT_REGISTRY_VERSION=2

ENABLE_DEBUG_ROUTES=false
ALLOW_DEMO_PAYERS_IN_LIVE=false
ALLOW_OPTIMISTIC_BUY_CONFIRM=false
ALLOW_HTTP_SELLER_ENDPOINTS=false
ALLOW_UNVERIFIED_OWNER_ACTIONS=false
```

## Database migration

Run `supabase-schema.sql` in Supabase SQL Editor. It is idempotent and adds:

- `mode`, `asset`, `seller_address`, `verified_at` on payments
- `mode`, `request_hash`, `settlement_ref`, `contract_address` on receipts
- `pending_buys` with TTL fields
- constraints for status, mode, rating
- indexes for settlement refs and receipt mode

After migration, clean old demo rows or set them explicitly:

```sql
update receipts set mode = 'mock' where payment_id like 'seed-%';
```

## Deploy ReceiptRegistryV2

```bash
npm ci
npm run compile
npm run deploy:receipts:v2
```

Set the printed values:

```env
NEXT_PUBLIC_RECEIPT_REGISTRY=0x...
NEXT_PUBLIC_RECEIPT_REGISTRY_VERSION=2
```

The deployer becomes owner and recorder. Add a separate hot recorder later with
`setRecorder(recorder, true)` and keep the owner key cold.

## Security gates

Before mainnet beta:

- `/api/wallet/debug` returns 404 unless `ENABLE_DEBUG_ROUTES=true`.
- `PATCH`/`DELETE /api/services` require Circle session or wallet signature.
- `POST /api/receipts` requires payer ownership.
- `/api/services/probe` rejects localhost, private IPs, redirects and non-HTTPS.
- `ALLOW_DEMO_PAYERS_IN_LIVE=false`.
- `ALLOW_OPTIMISTIC_BUY_CONFIRM=false` unless a settlement verifier is active.
- `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run compile` pass.

## Smoke test

1. Fetch catalog:

```bash
curl https://auragate.app/api/agent
```

Verify:

- `payment.mode = "live"`
- `network.mode = "mainnet"`
- `network.assetAddress` has no trailing spaces
- `network.receiptRegistryVersion = "2"`

2. Call paid endpoint unpaid:

```bash
curl -i https://auragate.app/api/premium/oracle-check
```

Verify:

- HTTP 402
- `PAYMENT-REQUIRED` or `payment-required` header exists

3. Pay with a funded x402 buyer agent.

Verify response headers:

- `x-receipt-id`
- `x-result-hash`
- `x-settlement-tx`
- `PAYMENT-RESPONSE` when provided by Gateway

4. Check receipt explorer and contract event.

Verify:

- receipt `mode = mainnet`
- payment has `verified_at`
- on-chain event `ReceiptRecordedV2`
- `settlementRef` is unique

## Go/no-go

Go for controlled beta only when:

- at least one real seller receives mainnet USDC
- mock receipts are excluded from stats/reputation
- service management and ratings are owner-gated
- receipt contract V2 is deployed and recorder is configured
- admin can hide abusive services
- logs and alerts exist for failed settlement/receipt writes

No-go if any P0 env flag is permissive in production.
