// Generate 5 standalone AI-agent HTML files. Each is a self-contained page
// (no install, no build) that connects to a LIVE AuraGate, buys APIs in its
// field over the x402 flow, and shows the full result. Run: node build.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_URL = "https://auragate.app";

const AGENTS = [
  {
    file: "agent-1-crypto.html", name: "CryptoQuant", emoji: "🪙", field: "Crypto markets",
    address: "0x77533660a9638208a6668AC4CEBd3Bb88c868FC5", color: "#FFC56E",
    actions: [
      { label: "Giá BTC hiện tại", slug: "oracle-check", query: "?coins=bitcoin" },
      { label: "Giá ETH hiện tại", slug: "oracle-check", query: "?coins=ethereum" },
      { label: "So giá BTC 3 sàn", slug: "price-multi-exchange", query: "?symbol=BTC" },
      { label: "Tổng quan thị trường", slug: "global-crypto" },
      { label: "Tâm lý Fear & Greed", slug: "sentiment" },
      { label: "Phí mạng Bitcoin", slug: "mempool" },
    ],
  },
  {
    file: "agent-2-markets.html", name: "WallStreet", emoji: "📈", field: "Stocks · Metals · FX",
    address: "0x2425a5c3a5acc0a3311F1086f2BaC224dBeA51F4", color: "#00CBB8",
    actions: [
      { label: "Cổ phiếu Apple", slug: "stocks", query: "?symbol=AAPL" },
      { label: "Cổ phiếu Tesla", slug: "stocks", query: "?symbol=TSLA" },
      { label: "Giá vàng & bạc", slug: "metals" },
      { label: "Tỷ giá USD", slug: "fx-rates" },
      { label: "Đổi 100 USD → VND", slug: "fx-convert", query: "?from=USD&to=VND&amount=100" },
    ],
  },
  {
    file: "agent-3-weather.html", name: "GeoScout", emoji: "🌍", field: "Weather · Geo · World",
    address: "0xaFC16eF31556489A3dd0f8Cb712eca9f3A7e5968", color: "#00F0FF",
    actions: [
      { label: "Thời tiết Hà Nội", slug: "weather", query: "?city=hanoi" },
      { label: "Thời tiết Tokyo", slug: "weather", query: "?city=tokyo" },
      { label: "Dự báo 7 ngày Sài Gòn", slug: "forecast", query: "?city=saigon" },
      { label: "Chất lượng không khí HN", slug: "air-quality", query: "?city=hanoi" },
      { label: "Giờ New York", slug: "timezone", query: "?tz=America/New_York" },
      { label: "Thông tin Việt Nam", slug: "country-info", query: "?country=Vietnam" },
    ],
  },
  {
    file: "agent-4-knowledge.html", name: "Scholar", emoji: "📚", field: "Knowledge · Research",
    address: "0x4500c0AbcC9F621f4f3E17191C48Cd9a85482B15", color: "#8A4DFF",
    actions: [
      { label: "Wikipedia: Stablecoin", slug: "wikipedia", query: "?title=Stablecoin" },
      { label: "Định nghĩa: blockchain", slug: "dictionary", query: "?word=blockchain" },
      { label: "Câu nói truyền cảm hứng", slug: "quote" },
      { label: "Ngày lễ Việt Nam", slug: "holidays", query: "?country=VN" },
    ],
  },
  {
    file: "agent-5-dev.html", name: "DevPulse", emoji: "💻", field: "Dev · Tech · DeFi",
    address: "0x55C149077f3f91Eb82150cB29882ae461E5A6109", color: "#3E73FF",
    actions: [
      { label: "Tin công nghệ (Hacker News)", slug: "news-tech" },
      { label: "Lượt tải npm: react", slug: "npm-stats", query: "?package=react" },
      { label: "GitHub: circlefin/x402", slug: "github-repo", query: "?repo=circlefin/x402" },
      { label: "DeFi TVL Top 10", slug: "defi-tvl" },
      { label: "Tóm tắt văn bản (AI)", slug: "summarize", method: "POST",
        body: { text: "AuraGate is a permissionless marketplace where AI agents pay USDC per request using the open x402 protocol on Arc testnet, with on-chain receipts as proof." } },
    ],
  },
];

const page = (a) => `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${a.emoji} ${a.name} — AuraGate agent</title>
<style>
  :root { --accent: ${a.color}; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background:#030A18; color:#E6EDF7; -webkit-font-smoothing:antialiased; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 60px; }
  .card { background:#0A1426; border:1px solid #1B2A45; border-radius:16px; }
  header.card { padding:18px 20px; display:flex; align-items:center; gap:14px;
    border-color: color-mix(in srgb, var(--accent) 45%, #1B2A45); }
  .emoji { font-size:34px; }
  h1 { margin:0; font-size:20px; }
  h1 .name { color: var(--accent); }
  .field { margin:2px 0 0; font-size:13px; color:#8597B0; }
  .addr { margin-top:4px; font-family: ui-monospace, monospace; font-size:11px; color:#5E6E88; }
  .urlrow { display:flex; gap:8px; margin:16px 0; }
  .urlrow input { flex:1; background:#06101F; border:1px solid #1B2A45; color:#E6EDF7;
    border-radius:10px; padding:10px 12px; font-size:13px; font-family: ui-monospace, monospace; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap:10px; margin-bottom:18px; }
  button.act { background:#0A1426; border:1px solid #233653; color:#E6EDF7; border-radius:12px;
    padding:14px 12px; font-size:14px; font-weight:600; text-align:left; cursor:pointer; transition:.15s; }
  button.act:hover { border-color: var(--accent); transform: translateY(-1px); }
  button.act:disabled { opacity:.5; cursor:wait; }
  button.act small { display:block; font-weight:400; color:#5E6E88; margin-top:3px; font-family:ui-monospace,monospace; font-size:11px; }
  .console { padding:16px 18px; min-height:160px; font-family: ui-monospace, monospace; font-size:12.5px; line-height:1.7; }
  .console .idle { color:#5E6E88; }
  .ln { white-space:pre-wrap; word-break:break-word; }
  .ln .b { color:#5E6E88; }
  .req { color:#8597B0; } .c402 { color:#FFC56E; } .pay { color:#3E73FF; }
  .data { color:#00CBB8; } .err { color:#FF6B7D; } .ok { color:#7CF5C0; font-weight:600; }
  pre.json { margin:6px 0 2px; padding:12px; background:#06101F; border:1px solid #1B2A45;
    border-radius:10px; color:#9FE9DC; overflow-x:auto; font-size:12px; }
  .note { color:#5E6E88; font-size:11px; margin-top:18px; line-height:1.6; }
  .note code { color:#9FB3D1; }
</style>
</head>
<body>
<div class="wrap">
  <header class="card">
    <div class="emoji">${a.emoji}</div>
    <div>
      <h1><span class="name">${a.name}</span> · agent mua API</h1>
      <p class="field">${a.field}</p>
      <p class="addr">ví: ${a.address}</p>
    </div>
  </header>

  <div class="urlrow">
    <input id="url" value="${DEFAULT_URL}" spellcheck="false" />
    <button class="act" style="flex:0 0 auto" onclick="saveUrl()">Lưu URL</button>
  </div>

  <div class="grid" id="actions"></div>

  <div class="card console" id="out"><span class="idle">$ Bấm một nút phía trên để agent đi mua API trên AuraGate…</span></div>

  <p class="note">
    Agent này là một <b>chương trình độc lập</b> — nó gọi thẳng tới AuraGate ở URL phía trên,
    thực hiện đủ quy trình <b>402 → trả tiền → nhận data</b> bằng ví riêng của nó.
    Đây là ví demo được AuraGate công nhận nên <b>không tốn USDC thật</b>.
    Đổi URL thành <code>http://localhost:3000</code> để test với máy của bạn.
  </p>
</div>

<script>
const AGENT = ${JSON.stringify({ address: a.address, actions: a.actions })};
let base = localStorage.getItem("auragate_url") || document.getElementById("url").value;
document.getElementById("url").value = base;

function saveUrl() {
  base = document.getElementById("url").value.trim().replace(/\\/$/, "");
  localStorage.setItem("auragate_url", base);
  line("ok", "✓ Đã lưu URL: " + base, true);
}
function short(s){ return s ? s.slice(0,8) + "…" + s.slice(-4) : ""; }
function out(){ return document.getElementById("out"); }
function line(cls, text, clear){
  if (clear) out().innerHTML = "";
  const p = document.createElement("div");
  p.className = "ln " + cls;
  p.innerHTML = '<span class="b">› </span>' + text;
  out().appendChild(p);
}
function showJson(obj){
  const pre = document.createElement("pre");
  pre.className = "json";
  pre.textContent = JSON.stringify(obj, null, 2);
  out().appendChild(pre);
}

async function run(action, btn){
  btn.disabled = true;
  out().innerHTML = "";
  const url = base.replace(/\\/$/, "") + "/api/premium/" + action.slug + (action.query || "");
  const isPost = action.method === "POST";
  const bodyOpt = isPost ? { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(action.body||{}) } : {};

  line("req", "① Hỏi: GET /api/premium/" + action.slug + (action.query||""));

  // Step 1 — call without paying → expect 402
  let r1;
  try { r1 = await fetch(url, bodyOpt); }
  catch(e){ line("err", "✗ Không gọi được AuraGate (mạng hoặc CORS): " + e.message); btn.disabled=false; return; }

  let challenge = null; try { challenge = await r1.clone().json(); } catch {}
  if (r1.status === 402) {
    const acc = challenge && challenge.accepts && challenge.accepts[0];
    const amt = acc ? (Number(acc.amount)/1e6) : "?";
    line("c402", "② Server đáp: 402 — cần trả $" + amt + " USDC cho " + short(acc && acc.payTo));
  } else {
    line("c402", "② Server đáp: " + r1.status + " (không phải 402 như mong đợi)");
  }

  // Step 2 — pay (sign) and retry
  const headers = {
    "x-payment": btoa(JSON.stringify({ payer: AGENT.address, ts: Date.now() })),
    "x-payer": AGENT.address,
  };
  if (isPost) headers["content-type"] = "application/json";

  let r2;
  try {
    r2 = await fetch(url, { method: action.method || "GET", headers, ...(isPost ? { body: JSON.stringify(action.body||{}) } : {}) });
  } catch(e){ line("err", "✗ Lỗi khi trả tiền: " + e.message); btn.disabled=false; return; }

  if (!r2.ok) { line("err", "✗ Thanh toán thất bại (HTTP " + r2.status + ")"); btn.disabled=false; return; }

  const receipt = r2.headers.get("x-receipt-id");
  const data = await r2.json().catch(()=>null);
  line("pay", "③ Đã ký + trả tiền → hóa đơn " + (receipt ? receipt.slice(0,12)+"…" : "(không có)"));
  line("data", "④ Nhận được dữ liệu:");
  showJson(data);
  line("ok", "✓ Xong — agent đã tự mua " + action.label + " trên AuraGate.");
  btn.disabled = false;
}

// render buttons
const grid = document.getElementById("actions");
AGENT.actions.forEach((action) => {
  const b = document.createElement("button");
  b.className = "act";
  b.innerHTML = action.label + "<small>" + action.slug + (action.query||"") + "</small>";
  b.onclick = () => run(action, b);
  grid.appendChild(b);
});
</script>
</body>
</html>
`;

for (const a of AGENTS) {
  writeFileSync(join(DIR, a.file), page(a));
  console.log("wrote", a.file);
}
console.log("\nDone. Open any agent-*.html in your browser.");
