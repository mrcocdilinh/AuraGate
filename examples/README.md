# Tạo agent đầu tiên của bạn 🤖

Thư mục này chứa ví dụ **đơn giản nhất** về một AI agent tự đi mua API từ AuraGate.

## `my-first-agent.mjs` — Agent mua giá crypto

Một agent chỉ ~50 dòng, không cần cài thư viện, mua 1 dịch vụ và in kết quả.

### Cách chạy

1. **Cần có Node.js** (bản 18 trở lên). Kiểm tra bằng:
   ```bash
   node --version
   ```

2. **Sửa URL**: mở `my-first-agent.mjs`, đổi dòng:
   ```js
   const AURAGATE_URL = "https://auragate.app";  // ← URL chợ của bạn
   ```

3. **Chạy**:
   ```bash
   node my-first-agent.mjs
   ```

### Bạn sẽ thấy

```
🤖 Agent đang hỏi mua: oracle-check

① Hỏi lần đầu → server trả: 402 (Phải trả tiền trước)
② Trả tiền + hỏi lại → server trả: 200 (Thành công!)

③ Agent đã nhận được dữ liệu giá crypto:
{ "prices": { "BTC": { "usd": 67420 } } }

🧾 Mã hóa đơn: rec_abc123
✨ Xong!
```

## Đổi sang dịch vụ khác

Chỉ cần đổi dòng `SERVICE`. Các lựa chọn:

| `SERVICE` | Mua gì |
|---|---|
| `oracle-check` | Giá BTC/ETH/SOL |
| `weather` | Thời tiết |
| `fx-rates` | Tỷ giá USD |
| `trending` | Coin đang hot |
| `joke` | Câu đùa lập trình (rẻ nhất) |
| `holidays` | Ngày lễ các nước |
| `ip-info` | Tra cứu IP |
| `country-info` | Thông tin quốc gia |
| `mempool` | Phí mạng Bitcoin |

## Đây là demo (tiền giả)

File này dùng địa chỉ ví demo nên **không tốn tiền thật**. Để mua bằng USDC
thật (có giao dịch trên blockchain), xem `npm run agent` ở thư mục gốc với
`X402_MODE=live` và `BUYER_PRIVATE_KEY`.
