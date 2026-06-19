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

---

## Lịch sử debug Circle Wallet Auth (2026-06)

Quá trình fix 2 bug đăng nhập Circle: (1) Google login tạo ví mới mỗi lần,
(2) Email login lỗi 502. Ghi lại để khỏi lặp lại sai lầm.

### Kiến trúc wallet hiện tại

```
Login (Google redirect / Email OTP)
  └─ W3SSdk trả về { userToken, encryptionKey }   ← encryptionKey từ LOGIN RESULT
       └─ ensureWalletAddress(userToken, encryptionKey, onProgress?)   [lib/wallet-client.ts]
            ├─ fetchAddress → POST /api/wallet/address (getUserWalletAddress → listWallets)
            │     └─ có ví → trả address (returning user)
            ├─ chưa có → POST /api/wallet/create-wallet (createWalletChallenge)
            │     ├─ PIN-less app → trả challengeId → executeChallenge
            │     └─ PIN-based app → 502 "User has not set up a PIN yet"
            │            └─ POST /api/wallet/init-pin (createUserPinWithWallets)
            │                  → challengeId → executeChallenge (hiện modal PIN)
            └─ poll fetchAddress (8 × 1.5s) cho tới khi ví xuất hiện
  └─ trả { address, error? }; UI show progress + lỗi on-screen (auth/callback)
```

### Các bug đã fix (gốc rễ)

1. **Google tạo ví mới mỗi session** — fallback dùng `demoAddress(userToken)`
   nhưng `userToken` là JWT mới mỗi lần login. Fix: seed ổn định
   `oAuthInfo.socialUserUUID ?? email ?? userToken` (`app/auth/callback/page.tsx`).

2. **Email 502 = SMTP error (code 155160)** — Circle gửi OTP qua SMTP (Resend)
   nhưng "From" address chưa verify domain. Fix: verify `auragate.app` trong
   Resend (DKIM/SPF/DMARC ở Namecheap), set SMTP "From" =
   `noreply@auragate.app` (khớp domain đã verify), password = Resend API key.
   DKIM "Verified" là đủ để gửi; SPF/MX "Pending" không chặn.

3. **`createUserPinWithWallets` code 2 "API parameter invalid"** — gọi sai cú
   pháp `(userToken, body)`. Flat client nhận **1 object duy nhất**:
   `{ userToken, idempotencyKey, blockchains }`. Sau fix → code 155105
   (invalid token với fake token = đúng).

4. **"Invalid credentials" / "PIN setup failed" khi execute challenge** — DÙNG
   SAI KEY. `setAuthentication({ userToken, encryptionKey })` cần
   `encryptionKey` từ **login result** (`SocialLoginResult.encryptionKey`),
   KHÔNG phải `deviceEncryptionKey` từ bước device-token. Sai key → error
   155118 (invalidEncryptionKey).

5. **Callback của `sdk.execute()` không fire sau Google OAuth** — login SDK đã
   unsubscribe postMessage. Fix: `executeChallenge()` luôn tạo **W3SSdk instance
   MỚI** + `setAuthentication()` rồi mới `execute()` (listener sạch).

### Bài học quan trọng (Circle SDK)

- **2 encryptionKey khác nhau**: `deviceEncryptionKey` (device-token step, dùng
  lúc OAuth handshake) vs `encryptionKey` (login result, dùng cho
  `setAuthentication` để chạy challenge). Đừng nhầm.
- **Flat client** (`initiateUserControlledWalletsClient`) — mọi method nhận
  **1 object** (vd `createWallet({ userToken, blockchains })`,
  `createUserPinWithWallets({ userToken, idempotencyKey, blockchains })`).
- **PIN-based app**: `createWallet` fail tới khi user set PIN. Dùng
  `createUserPinWithWallets` (= REST `POST /v1/w3s/user/initialize`) để set PIN
  + tạo ví trong 1 challenge. Modal PIN do client SDK `execute()` render.
- **Error codes** (xem `@circle-fin/w3s-pw-web-sdk/dist/src/types.d.ts`
  enum `ErrorCode`): 155105 invalidUserToken, 155118 invalidEncryptionKey,
  155112 incorrectUserPin, 155160 SMTP fail, code 2 apiParameterInvalid.
- **Debug endpoint** `GET /api/wallet/debug` — gọi thẳng Circle API với token
  giả để đọc error code thật (emailToken / createWallet / initPin).
- **`/api/wallet/address` trả 404 khi chưa có ví** — đúng thiết kế,
  `fetchAddress` bắt và trả null.

### UX diagnostic đã thêm

- `ensureWalletAddress` trả `{ address, error? }` + `onProgress` callback;
  trang `auth/callback` show từng bước + lỗi **on-screen** (không cần đọc
  console). Lỗi wallet-setup → `failPersist` (không auto-redirect để đọc được).
- Badge ví connected: chấm **xanh** = ví Circle thật, chấm **vàng + "DEMO"** =
  demo fallback (`components/connect-button.tsx`).

### Trạng thái

- ✅ Google login: connect thành công, ví **Circle THẬT** trên ARC-TESTNET
  (badge chấm xanh, không nhãn — đã confirm trên production), ổn định theo
  account (không tạo ví mới mỗi lần).
- ⏳ Email OTP: chờ DNS Resend verify đầy đủ + SMTP "From" khớp domain.
