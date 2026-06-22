<div align="center">

# AuraGate

**The open, permissionless registry for AI agent payments on Arc.**

Any developer lists an x402 service. Any AI agent pays per-request in USDC — no API keys, no subscriptions. Trust comes from on-chain receipts and earned reputation, not gatekeeping.

[Live demo](https://auragate.app) · [Agent catalog](https://auragate.app/api/agent) · [Receipt explorer](https://auragate.app/receipts)

</div>

---

## What it is

AuraGate is a marketplace + payment gateway for the agentic economy. AI agents discover services, pay for them per-call with the [x402 protocol](https://www.x402.org) over USDC on [Arc](https://www.circle.com/arc), and receive an on-chain receipt as proof.

It's the **permissionless alternative** to Circle's curated `agents.circle.com`:

| | AuraGate | Curated marketplace |
|---|---|---|
| Listing | Self-serve, no approval | Invite-only ("talk to us") |
| Trust signal | On-chain receipts + reputation score | Platform curation |
| Seller endpoints | Self-hosted, health-checked | Vetted |
| Receipts | Public explorer + CSV export | — |

## Features

- **Open registry** — list any x402 endpoint in seconds; we health-check it for a valid 402 challenge at registration.
- **On-chain reputation** — 0–100 score per seller = rating quality (50%) + demand (30%) + verified coverage (20%).
- **x402 payments** — HTTP 402 → EIP-3009 USDC authorization → verify + settle via Circle Gateway → on-chain receipt.
- **Receipt explorer** — every payment public, exportable to CSV, linked to Arc block explorer.
- **Seller dashboard** — self-serve register / toggle / delete services.
- **Headless buyer agent** — `npm run agent` drives the full flow with a spending cap.
- **Circle wallets** — email / Google login, no seed phrase.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind · Supabase · viem · Hardhat (Solidity 0.8.24) · Circle x402 + User-Controlled Wallets · Arc Testnet.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm run agent        # headless buyer agent (mock mode)
npm run typecheck
```

## x402 payment flow

1. Agent calls an endpoint (e.g. `/api/premium/oracle-check`).
2. Server returns `402 Payment Required` + challenge (amount, payTo, network).
3. Agent signs an `X-PAYMENT` header (EIP-3009 TransferWithAuthorization).
4. Agent retries with the header.
5. Server verifies + settles via Circle Gateway.
6. Server returns data + `x-receipt-id`, `x-result-hash`, `x-settlement-tx`.
7. Receipt is recorded on-chain in `ReceiptRegistry`.

**Mock mode** (`X402_MODE=mock`) — accepts any payment header, moves no funds. Good for local dev / public demo.
**Live mode** (`X402_MODE=live`) — real Circle Gateway testnet settlement.

## On-chain

| | |
|---|---|
| Chain | Arc Testnet (chainId `5042002`) |
| Explorer | https://testnet.arcscan.app |
| Gas token | USDC |
| ReceiptRegistry | [`0x11723de83d8a320c466585fb1545777cfcb4c947`](https://testnet.arcscan.app/address/0x11723de83d8a320c466585fb1545777cfcb4c947) |

## Environment

See `CLAUDE.md` for the full list. Key vars:

```env
X402_MODE=mock                      # or live
SUPABASE_URL=...                    # persistence (falls back to in-memory)
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_RECEIPT_REGISTRY=0x...  # deployed contract
NEXT_PUBLIC_SITE_URL=https://auragate.app
```

## Docs

- [`docs/DEPLOY_CONTRACT.md`](docs/DEPLOY_CONTRACT.md) — deploy ReceiptRegistry to Arc
- [`docs/MAINNET_READINESS.md`](docs/MAINNET_READINESS.md) — mainnet beta hardening checklist
- [`docs/PIN_LESS_MODE.md`](docs/PIN_LESS_MODE.md) — Circle wallet PIN setup
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — pitch video script

## Mainnet beta posture

AuraGate's recommended production flow keeps payments on x402/Circle Gateway:
agents pay the seller wallet advertised in the 402 challenge, then AuraGate
records a V2 receipt after settlement. The receipt contract is **not** escrow.

Before mainnet, run:

```bash
npm ci
npm test
npm run typecheck
npm run compile
npm run build
npm run deploy:receipts:v2
```

Production deployments should set `X402_MODE=live`,
`NEXT_PUBLIC_NETWORK_MODE=mainnet`, `NEXT_PUBLIC_RECEIPT_REGISTRY_VERSION=2`,
and keep `ALLOW_DEMO_PAYERS_IN_LIVE=false`, `ENABLE_DEBUG_ROUTES=false`.

---

<div align="center">
Built on Circle's Agent Stack + x402 · Stablecoin-native, permissionless, provable.
</div>
