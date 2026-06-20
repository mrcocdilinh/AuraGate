# Deploy ReceiptRegistry lên Arc Testnet

On-chain receipt write **đã wire sẵn** trong code (`lib/onchain.ts` + `app/api/premium/[service]/route.ts`).
Sau khi settle x402, server tự gọi `recordReceipt()` trên contract — chỉ cần deploy contract + set 2 env var.

## Chạy ở MÁY LOCAL (không phải trên Vercel/sandbox)

Cần: Node 18+, một ví testnet có **USDC trên Arc Testnet** (dùng làm gas).

### 1. Tạo `.env.local`

```env
DEPLOYER_PRIVATE_KEY=0x...           # ví testnet, ĐÃ có USDC để trả gas
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
```

### 2. Compile + deploy

```bash
npm install
npm run compile          # hardhat compile → tạo artifact
npm run deploy:receipts  # deploy lên Arc Testnet qua viem
```

Output sẽ in ra:

```
ReceiptRegistry deployed to: 0xABC...123
NEXT_PUBLIC_RECEIPT_REGISTRY=0xABC...123
```

### 3. Set env trên Vercel

Vercel → Settings → Environment Variables → thêm:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_RECEIPT_REGISTRY` | `0xABC...123` (địa chỉ vừa deploy) |
| `DEPLOYER_PRIVATE_KEY` | `0x...` (ví ký giao dịch recordReceipt — cần USDC gas) |

> `DEPLOYER_PRIVATE_KEY` trên Vercel dùng để server ký giao dịch ghi receipt on-chain
> sau mỗi lần thanh toán. Ví này phải luôn có chút USDC để trả gas.

### 4. Redeploy Vercel

Sau redeploy: mỗi lần agent trả tiền x402 → receipt được ghi lên Arc Testnet.
`/receipts` sẽ show link `x-settlement-tx` + on-chain status bar chuyển sang "deployed".

## Lấy USDC testnet ở đâu

- Arc Testnet faucet (hỏi trong Circle/Arc Discord office hours)
- Hoặc bridge USDC testnet sang Arc qua Circle CCTP testnet

## Kiểm tra

Sau khi deploy, mở explorer:
`https://testnet.arcscan.app/address/<NEXT_PUBLIC_RECEIPT_REGISTRY>`
→ thấy contract + các tx `recordReceipt` mỗi lần có thanh toán.
