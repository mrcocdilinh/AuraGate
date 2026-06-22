# AuraGate — Demo Video Script (pitch Circle/Arc)

**Độ dài mục tiêu:** 2:30–3:00 phút
**Thông điệp chính:** AuraGate là **open, permissionless registry** cho agent payments
trên Arc — đối trọng với marketplace curated của Circle (agents.circle.com).
Trust đến từ **on-chain receipts + earned reputation**, không phải gatekeeping.

---

## 0:00–0:20 — Hook (mở đầu)

**Hình:** Landing page `/` (hero "open registry").

**Lời thoại:**
> "Circle's agent marketplace is invite-only — 'talk to us' to get listed.
> AuraGate is the permissionless alternative. Any developer can list an x402
> service in seconds, and any AI agent can pay for it with USDC on Arc — no API
> keys, no subscriptions, no approval needed."

---

## 0:20–0:50 — Registry + Reputation (điểm khác biệt #1)

**Hình:** `/services` → scroll, hover tags/sort → click vào một service.
Rồi mở `/sellers` cho thấy leaderboard reputation 0–100.

**Lời thoại:**
> "Here's the open registry. Every service is discoverable, sortable, tagged.
> But the real differentiator is trust. Instead of Circle deciding who's legit,
> AuraGate computes an on-chain reputation score — 0 to 100 — from rating
> quality, real demand, and verified endpoint coverage. Trust is earned, not
> granted."

---

## 0:50–1:40 — x402 Payment Flow live (core demo)

**Hình:** `/services/[slug]` → bấm **Try service**.
Show: 402 challenge → ký X-PAYMENT → settle → response + receipt headers
(`x-receipt-id`, `x-result-hash`, `x-settlement-tx`).

**Lời thoại:**
> "Let's pay for one. The agent hits the endpoint, gets a 402 Payment Required
> with an x402 challenge. It signs a USDC authorization — EIP-3009 — and retries.
> Circle Gateway verifies and settles on Arc in under a second. Back comes the
> data, plus an on-chain receipt: payer, amount, result hash, settlement tx.
> Every call is provable."

**Nhấn mạnh:** chỉ vào sub-second settlement + USDC-as-gas của Arc.

---

## 1:40–2:10 — Receipt Explorer + On-chain proof (điểm khác biệt #2)

**Hình:** `/receipts` → show bảng receipts, bấm **Export CSV**, click link tx
mở `testnet.arcscan.app`.

**Lời thoại:**
> "Every payment lands in the public receipt explorer — exportable to CSV,
> each one linking to the transaction on Arc's block explorer. This is the
> audit trail that makes a permissionless registry trustworthy. The
> ReceiptRegistry contract records every receipt on-chain."

---

## 2:10–2:40 — Seller self-service (điểm khác biệt #3)

**Hình:** `/dashboard` → điền RegisterService form (externalUrl, tags, price)
→ submit → service xuất hiện trong registry với verified badge.

**Lời thoại:**
> "And listing? Self-serve. A seller pastes their x402 endpoint, we health-check
> it for a valid 402 response, and it's live in the registry instantly. No
> gatekeeper. Sellers keep ownership of their endpoints and receive payments
> directly."

---

## 2:40–3:00 — Close (kêu gọi)

**Hình:** quay lại landing, logo AuraGate.

**Lời thoại:**
> "AuraGate: the open layer for the agentic economy on Arc. Stablecoin-native,
> permissionless, provable. Built on Circle's Agent Stack and x402. Let's make
> agent commerce open by default."

---

## Checklist quay

- [ ] Bật `X402_MODE=live` để settlement tx thật (hoặc mock nếu chưa có USDC)
- [ ] Deploy ReceiptRegistry trước để link explorer hoạt động (xem `DEPLOY_CONTRACT.md`)
- [ ] Seed sẵn vài receipts để explorer không trống
- [ ] Đăng nhập Google sẵn (ví Circle thật, badge chấm xanh)
- [ ] Quay 1080p, ẩn bookmark bar trình duyệt
- [ ] Tốc độ nói vừa phải, để khoảng lặng khi settlement chạy (cho thấy sub-second)

## Phiên bản ngắn 60s (cho X/Twitter)

Hook (0:00–0:10) → Try service x402 (0:10–0:35) → Receipt on-chain (0:35–0:50)
→ "open & permissionless" close (0:50–1:00).
