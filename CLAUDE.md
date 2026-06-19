# AuraGate — Project Context for Claude Code

## Dự án là gì

AuraGate là một **marketplace thanh toán cho AI agents** trên Arc blockchain.
AI agents có thể tìm API/dịch vụ, trả USDC theo từng request bằng giao thức x402
(không cần API key, không subscription), và nhận on-chain receipt làm bằng chứng.

**Mục tiêu:** Pitch với Circle và Arc để được support/listing trong Agent Marketplace.

## Tại sao AuraGate thay vì AuraPredict

- AuraPredict (prediction market) có rủi ro pháp lý, khó demo, settlement phức tạp.
- AuraGate là payment infrastructure — đúng thesis của Circle (Agent Stack, x402,
  Gateway nanopayments) và Arc (Agentic economy blueprint), ít legal risk hơn.
- AuraPredict vẫn tồn tại, được đưa vào AuraGate làm **seller đầu tiên** (paid
  market-insight API), biến nó thành service thay vì competitor.

## Điểm khác biệt so với demo chính thức của Circle

Repo `circlefin/arc-nanopayments` của Circle đã có x402 endpoint + buyer agent cơ bản.
AuraGate bổ sung 3 thứ Circle chưa làm:
1. **Multi-seller registry** — nhiều người bán đăng ký động, không phải 1 seller cứng.
2. **Receipt explorer + ratings** — public explorer có rating 1-5 sao, xây reputation.
3. **AuraPredict là seller thật** — không phải demo giả, là sản phẩm thực tế.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Payments:** `@circle-fin/x402-batching` (verify + settle), `@x402/core`, `@x402/evm`
- **Wallets:** `@circle-fin/user-controlled-wallets` + `@circle-fin/w3s-pw-web-sdk`
- **Blockchain:** Arc Testnet (chainId 5042002, USDC làm gas, sub-second finality)
- **Smart contract:** Hardhat + Solidity 0.8.24 (`contracts/ReceiptRegistry.sol`)
- **Agent:** `tsx` + `agent/run.mts` (mock mode + live GatewayClient + Claude summary)
- **Persistence:** In-memory (MVP), target là Supabase (schema sẵn ở `lib/store.ts`)
- **Viem:** cho EVM interactions

## Kiến trúc

```
Next.js App Router
├── app/
│   ├── page.tsx              # Landing — hero, flow strip, AuraPredict spotlight
│   ├── services/             # Marketplace (list + filter)
│   │   └── [slug]/           # Service detail + TryService x402 demo
│   ├── dashboard/            # Seller dashboard (revenue stats + register form)
│   ├── receipts/             # Receipt explorer với rating
│   ├── playground/           # Browser agent demo với spending limit
│   └── api/
│       ├── services/         # GET list / POST register
│       ├── premium/[service] # x402-protected endpoints
│       ├── receipts/         # GET list / POST rate
│       ├── agent/            # Machine-readable catalog cho AI agents
│       └── wallet/           # Circle wallet session token
├── components/
│   ├── nav.tsx, footer.tsx
│   ├── connect-button.tsx    # Email/Google login dropdown
│   ├── wallet-provider.tsx   # Context: demo mode hoặc real Circle SDK
│   └── ui.tsx                # Stars, Stat, CategoryPill
├── lib/
│   ├── types.ts              # Service, Payment, Receipt interfaces
│   ├── store.ts              # In-memory DB (services/payments/receipts)
│   ├── services-seed.ts      # 4 seed services (AuraPredict, oracle, AI, data)
│   ├── x402.ts               # Payment layer: mock + live Circle Gateway
│   ├── arc.ts                # Arc Testnet config (chainId, RPC, explorer)
│   ├── circle.ts             # Circle User-Controlled Wallets helper
│   └── format.ts             # shortAddr, usd, timeAgo, resultHash
├── contracts/
│   └── ReceiptRegistry.sol   # On-chain receipt + rating contract
├── scripts/
│   └── deploy_receipts.cjs   # Hardhat deploy script
└── agent/
    └── run.mts               # Headless buyer agent
```

## x402 Payment Flow

1. Agent gọi endpoint (vd `/api/premium/market-insight`)
2. Server trả `402 Payment Required` + challenge body (amount, payTo, network)
3. Agent ký `X-PAYMENT` header (EIP-3009 TransferWithAuthorization)
4. Agent retry với header đó
5. Server verify + settle qua Circle Gateway
6. Server trả data + headers: `x-receipt-id`, `x-result-hash`, `x-settlement-tx`
7. Receipt được lưu in-memory (và sẽ ghi lên ReceiptRegistry contract)

**Mock mode** (X402_MODE=mock): accept any X-PAYMENT header, không cần Circle account.
**Live mode** (X402_MODE=live): dùng Circle Gateway testnet facilitator thật.

## Trạng thái hiện tại

### ✅ Week 1 — Scaffold xong
- x402 paid endpoints (mock + live)
- 4 seed services: AuraPredict market-insight, oracle-check, summarize, dataset
- Marketplace UI, service detail, seller dashboard, receipt explorer, agent playground
- Headless buyer agent (`npm run agent`)
- ReceiptRegistry.sol contract
- Circle wallet demo mode (email/Google login)

### 🔲 Week 2 — Tiếp theo
- [ ] Deploy `ReceiptRegistry` lên Arc Testnet
      → `npm run compile && npm run deploy:receipts`
      → Set `NEXT_PUBLIC_RECEIPT_REGISTRY=0x...` trong env
- [ ] Kết nối on-chain write: sau khi settle, gọi `recordReceipt()` trên contract
- [ ] Supabase persistence (thay in-memory store)
- [ ] Revenue analytics sâu hơn (chart theo thời gian, top buyers)

### 🔲 Week 3
- [ ] Agent Wallet spending policy
- [ ] Demo video
- [ ] Submit Circle/Arc office hours
- [ ] Xin listing vào Agent Marketplace của Circle

## Env Variables quan trọng

```env
X402_MODE=mock                          # hoặc live
SELLER_ADDRESS=0x...                   # wallet nhận USDC
GATEWAY_FACILITATOR_URL=https://gateway-api-testnet.circle.com
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_EXPLORER=https://testnet.arcscan.app
NEXT_PUBLIC_USDC_ADDRESS=0x...         # USDC trên Arc Testnet
NEXT_PUBLIC_RECEIPT_REGISTRY=0x...     # sau khi deploy contract
BUYER_PRIVATE_KEY=0x...                # agent wallet (testnet only)
AGENT_TARGET_URL=http://localhost:3000
ANTHROPIC_API_KEY=...                  # optional, cho Claude summary trong agent
AURAEDICT_INDEXER_URL=https://api.aurapredict.xyz
CIRCLE_API_KEY=...                     # optional, cho real Circle wallets
NEXT_PUBLIC_CIRCLE_APP_ID=...          # optional
DEPLOYER_PRIVATE_KEY=0x...             # cho hardhat deploy
```

## Lệnh hay dùng

```bash
npm run dev              # dev server localhost:3000
npm run agent            # chạy headless buyer agent
npm run agent -- --limit 0.05   # với spending cap
npm run typecheck        # TypeScript check
npm run compile          # compile Solidity
npm run deploy:receipts  # deploy ReceiptRegistry lên Arc Testnet
```

## Arc Testnet

| | |
|---|---|
| Chain ID | 5042002 |
| CAIP-2 | eip155:5042002 |
| RPC | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |
| Gas token | USDC |

## Ghi chú quan trọng

- **In-memory store** reset mỗi khi server restart. Production cần Supabase.
- `lib/store.ts` surface maps 1:1 với Supabase tables — swap là mechanical.
- Mock mode không move real funds — dùng cho demo/local dev.
- `tsconfig.json` exclude `agent/` vì agent dùng `tsx` riêng.
- `next-env.d.ts` trong `.gitignore` — Next.js tự generate.
- AuraPredict seller address là placeholder — cần thay bằng địa chỉ thật khi live.
