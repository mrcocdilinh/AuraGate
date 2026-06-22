// ════════════════════════════════════════════════════════════════════
//  MY FIRST AGENT — mua 1 API từ AuraGate
//
//  Đây là một "agent" đơn giản nhất: một đoạn mã tự đi mua dữ liệu.
//  Không cần cài thư viện gì cả. Chỉ cần Node.js (bản 18 trở lên).
//
//  CÁCH CHẠY:
//    1. Sửa AURAGATE_URL bên dưới thành URL Vercel của bạn
//    2. Mở terminal, gõ:  node my-first-agent.mjs
// ════════════════════════════════════════════════════════════════════

// ── Cấu hình: bạn chỉ cần sửa 2 dòng này ────────────────────────────
const AURAGATE_URL = "https://auragate.app";   // ← URL chợ của bạn
const SERVICE = "oracle-check";                // ← dịch vụ muốn mua (giá crypto)

// Địa chỉ ví "demo" — chợ nhận ra địa chỉ này và cho mua thử miễn phí,
// không tốn tiền thật, không cần private key.
const DEMO_WALLET = "0xDemoAgent0000000000000000000000000000001";

const endpoint = `${AURAGATE_URL}/api/premium/${SERVICE}`;

// ── BƯỚC 1: Agent thử lấy dữ liệu (chưa trả tiền) ───────────────────
console.log(`\n🤖 Agent đang hỏi mua: ${SERVICE}\n`);

const lan1 = await fetch(endpoint);
console.log(`① Hỏi lần đầu → server trả: ${lan1.status} (Phải trả tiền trước)`);

// ── BƯỚC 2: Agent "ký" một phiếu trả tiền rồi hỏi lại ───────────────
// (Trong demo, phiếu này chỉ là chuỗi giả. Khi chạy thật, đây là chữ ký USDC.)
const phieuTraTien = Buffer.from(
  JSON.stringify({ payer: DEMO_WALLET })
).toString("base64");

const lan2 = await fetch(endpoint, {
  headers: {
    "x-payment": phieuTraTien,   // ← phiếu trả tiền
    "x-payer": DEMO_WALLET,      // ← ai trả
  },
});
console.log(`② Trả tiền + hỏi lại → server trả: ${lan2.status} (Thành công!)\n`);

// ── BƯỚC 3: Nhận dữ liệu + hóa đơn ──────────────────────────────────
const duLieu = await lan2.json();
const hoaDon = lan2.headers.get("x-receipt-id");

console.log("③ Agent đã nhận được dữ liệu giá crypto:");
console.log(JSON.stringify(duLieu, null, 2));
console.log(`\n🧾 Mã hóa đơn: ${hoaDon}`);
console.log("\n✨ Xong! Agent vừa tự mua dữ liệu chỉ trong vài dòng code.\n");
