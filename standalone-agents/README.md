# 5 AuraGate Standalone Agents

Năm "con agent" độc lập — mỗi cái là **một file HTML tự chứa**, không cần cài đặt gì.
Mở bằng trình duyệt → bấm nút → agent tự đi mua API trên AuraGate và hiện kết quả.

| File | Agent | Lĩnh vực | Ví dụ nút bấm |
|---|---|---|---|
| `agent-1-crypto.html` | 🪙 CryptoQuant | Crypto | Giá BTC, Giá ETH, So giá 3 sàn, Fear & Greed |
| `agent-2-markets.html` | 📈 WallStreet | Cổ phiếu · Vàng · FX | Apple, Tesla, Vàng/Bạc, Đổi USD→VND |
| `agent-3-weather.html` | 🌍 GeoScout | Thời tiết · Địa lý | Thời tiết HN, Dự báo 7 ngày, AQI, Giờ NY |
| `agent-4-knowledge.html` | 📚 Scholar | Kiến thức | Wikipedia, Từ điển, Câu nói hay, Ngày lễ |
| `agent-5-dev.html` | 💻 DevPulse | Dev · DeFi | Tin tech, npm, GitHub, DeFi TVL, Tóm tắt AI |

## Cách dùng

1. **Mở file** — double-click `agent-1-crypto.html` (mở trong Chrome/Edge/Firefox).
2. **Kiểm tra URL** — ô trên cùng mặc định `https://auragate.app`. Đổi thành
   `http://localhost:3000` nếu muốn test với máy bạn, rồi bấm **Lưu URL**.
3. **Bấm một nút** — ví dụ "Giá BTC hiện tại". Agent sẽ chạy đủ 4 bước ngay trên màn hình:
   ```
   ① Hỏi: GET /api/premium/oracle-check?coins=bitcoin
   ② Server đáp: 402 — cần trả $0.005 USDC cho 0x891008…04D0
   ③ Đã ký + trả tiền → hóa đơn 7a3f9c21…
   ④ Nhận được dữ liệu: { bitcoin: { usd: 67420, ... } }
   ✓ Xong
   ```

## Mỗi agent một ví riêng

| Agent | Địa chỉ ví |
|---|---|
| CryptoQuant | `0x77533660a9638208a6668AC4CEBd3Bb88c868FC5` |
| WallStreet | `0x2425a5c3a5acc0a3311F1086f2BaC224dBeA51F4` |
| GeoScout | `0xaFC16eF31556489A3dd0f8Cb712eca9f3A7e5968` |
| Scholar | `0x4500c0AbcC9F621f4f3E17191C48Cd9a85482B15` |
| DevPulse | `0x55C149077f3f91Eb82150cB29882ae461E5A6109` |

Các ví này được AuraGate công nhận là **ví demo** → mua được mà **không tốn USDC thật**.
Mọi giao dịch vẫn được ghi vào `/receipts` và `/dashboard` của AuraGate với đúng địa chỉ ví.

## Muốn trả USDC THẬT?

Các file HTML này chạy ở chế độ demo (không dùng private key — an toàn cho trình duyệt).
Để 5 agent trả USDC thật trên Arc, dùng bản chạy bằng terminal:

```bash
# nạp USDC testnet vào 5 ví ở trên trước, rồi:
AGENT_TARGET_URL=https://auragate.app X402_MODE=live npm run fleet
```

## Tùy chỉnh

Sửa danh sách nút / lĩnh vực trong `build.mjs` rồi chạy lại:

```bash
node build.mjs
```
