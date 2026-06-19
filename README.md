# AuraGate

**The discovery & payment marketplace for the agentic economy on Arc.**

AI agents discover APIs, pay **USDC per request** with [x402](https://docs.x402.org)
+ [Circle Gateway nanopayments](https://developers.circle.com/gateway/nanopayments)
— no API keys, no subscriptions — and receive an **on-chain receipt** as proof of
quality. Sellers list a service, get paid in USDC on **Arc**, and build reputation
from those receipts.

Users sign in with **email or Google** via
[Circle User-Controlled Wallets](https://developers.circle.com/wallets/user-controlled)
— no seed phrases.

> Testnet MVP. Not a financial product. Not financial advice.

## Why this fits Circle & Arc

- **Agentic economy** — directly targets Circle's Agent Stack (Agent Wallets,
  Agent Marketplace, Nanopayments) and Arc's agentic-commerce blueprint.
- **Stablecoin-native** — USDC settlement, USDC gas on Arc, x402 v2.
- **Differentiated vs the official demo** — AuraGate adds the three layers the
  `circlefin/arc-nanopayments` reference does not: a **multi-seller registry**, a
  **public receipt explorer with ratings**, and **AuraPredict as the first real
  seller** (paid market-insight API).

## Architecture

```
Next.js (App Router, TS, Tailwind)
├─ Frontend            ├─ API routes
│  /            landing │  /api/services            registry (list/register)
│  /services    market  │  /api/premium/[service]   x402-protected endpoints
│  /dashboard   seller  │  /api/receipts            explorer + ratings
│  /receipts    explorer│  /api/agent               machine-readable catalog
│  /playground  agent   │  /api/wallet/*            Circle wallet session
└─ Circle wallets       └─ @circle-fin/x402-batching (verify + settle)

Buyer agent (agent/run.mts)  →  GatewayClient.pay()  →  Arc Testnet
Contracts (contracts/ReceiptRegistry.sol)            →  on-chain receipts
```

## Quick start

```bash
npm install
cp .env.example .env.local   # also copy to .env for the agent/hardhat
npm run dev                  # http://localhost:3000
```

Everything runs **out of the box in mock mode** — no Circle account or testnet
funds required. Try a service on its detail page, then watch the
`/playground` agent buy across the whole catalog.

Run the headless agent against your dev server:

```bash
npm run agent -- --limit 0.05
```

## Going live (real Circle Gateway + wallets)

Set in `.env.local`:

| Variable | Purpose |
|---|---|
| `X402_MODE=live` | Use the real Circle Gateway testnet facilitator |
| `SELLER_ADDRESS` | Wallet that receives USDC |
| `GATEWAY_FACILITATOR_URL` | `https://gateway-api-testnet.circle.com` |
| `CIRCLE_API_KEY` / `NEXT_PUBLIC_CIRCLE_APP_ID` | Real email/Google wallet login |
| `BUYER_PRIVATE_KEY` | Buyer agent wallet (testnet) |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC token on Arc Testnet |

Deploy the receipt contract:

```bash
npm run compile
npm run deploy:receipts        # prints NEXT_PUBLIC_RECEIPT_REGISTRY=0x...
```

## Arc Testnet

| | |
|---|---|
| Chain ID | `5042002` (`eip155:5042002`) |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Gas / settlement | USDC |

## Tech

Next.js · React · TypeScript · Tailwind · `@circle-fin/x402-batching` ·
`@circle-fin/w3s-pw-web-sdk` · `@x402/core` · viem · Hardhat · Anthropic SDK.

## Roadmap

- **Week 1** — x402 paid endpoints, seller dashboard, AuraPredict seller. ✅ (this scaffold)
- **Week 2** — deploy ReceiptRegistry, dynamic registry, receipt explorer, agent manifest.
- **Week 3** — revenue analytics, Agent Wallet spending policy, demo video, Circle/Arc office hours.

## Notes

- Mock mode is for local dev/demo only; it does not move real funds.
- Persistence is in-memory in this MVP; the production target is Supabase
  (the `lib/store.ts` surface maps 1:1 to those tables).