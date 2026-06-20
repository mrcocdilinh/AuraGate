# Chuyển Circle App sang PIN-less mode

## Vấn đề

Login lần đầu (Google account mới chưa có ví) → modal PIN của Circle không hiện ra
→ user kẹt ở "Checking for existing wallet…". Đây là do app đang ở **PIN-based mode**.

PIN-less mode bỏ hẳn bước set PIN → ví tạo ngay sau login, không modal nào cả.
Đây là **fix gốc rễ**, không phải workaround code.

## Cách làm (trong Circle Console — không cần code)

1. Vào [console.circle.com](https://console.circle.com)
2. Chọn project AuraGate → **Programmable Wallets** → **User-Controlled**
3. Tìm setting **"Account Type"** hoặc **"Security"** / **"PIN requirement"**
4. Chuyển từ **PIN + Security Questions** → **PIN-less** (hoặc "No PIN")
5. Save

> Nếu Console không cho đổi trực tiếp, tạo **App config mới** với PIN-less
> rồi cập nhật `NEXT_PUBLIC_CIRCLE_APP_ID` mới trong Vercel env.

## Sau khi đổi

- Code đã sẵn sàng: `lib/wallet-client.ts` đã handle cả 2 mode
  (PIN-less → `createWallet` trả challengeId luôn; PIN-based → cần `init-pin` trước).
- Login Google account mới → ví tạo ngay, không hỏi PIN.
- Test bằng một Google account **chưa từng tạo ví** để confirm.

## Trạng thái code

- ✅ Google login ổn định (ví Circle thật, không tạo mới mỗi lần)
- ✅ Returning user (đã có ví) → vào thẳng, không hỏi gì
- ⏳ First-time user → chờ đổi PIN-less mode trong Console là xong
