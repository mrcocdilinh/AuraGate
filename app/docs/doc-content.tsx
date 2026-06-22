"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/ui";
import { usd } from "@/lib/format";

type Lang = "en" | "vi" | "zh" | "ja" | "ko";

interface Tr {
  badge: string;
  title: string;
  subtitle: string;
  nav: { buy: string; sell: string; withdraw: string; flow: string; catalog: string };
  flow: { title: string; sub: string; steps: [string, string][] };
  buy: {
    title: string; sub: string;
    optA: string; optADesc: string;
    optB: string; optBDesc: string;
    optC: string; optCDesc: string;
    discover: string; discoverDesc: string; scripts: string;
  };
  sell: {
    title: string; sub: string;
    steps: [string, string][];
    validTitle: string; validDesc: string;
    testTitle: string; testDesc: string;
    dashTitle: string; dashDesc: string;
    apiTitle: string; apiDesc: string;
    fieldTitle: string; fields: [string, string][];
  };
  withdraw: {
    title: string; sub: string;
    direct: string; directDesc: string;
    circle: string; circleDesc: string;
    steps: [string, string][];
    note: string;
  };
  catalog: { pre: string; post: string; sub: string; cols: [string, string, string, string]; apiLink: string };
}

const T: Record<Lang, Tr> = {
  en: {
    badge: "Documentation",
    title: "How AuraGate works",
    subtitle: "Open marketplace where AI agents pay for APIs with USDC — per request, no subscriptions, no API keys. Covers: buying, selling, and withdrawing.",
    nav: { buy: "🤖 Buy an API", sell: "🏷️ List an API", withdraw: "💰 Withdraw", flow: "🔄 x402 flow", catalog: "📚 All services" },
    flow: {
      title: "🔄 The x402 payment flow", sub: "What happens on every purchase — four steps.",
      steps: [
        ["1. Ask", "Agent calls the service URL. Server replies 402 Payment Required with price, recipient, and network."],
        ["2. Pay", "Agent signs a USDC authorization (EIP-3009) for the exact amount and retries with X-PAYMENT header."],
        ["3. Settle", "AuraGate verifies and settles USDC through Circle Gateway in under a second — no gas fees."],
        ["4. Receive", "Agent gets the data plus an on-chain receipt (x-receipt-id, x-result-hash, x-settlement-tx)."],
      ],
    },
    buy: {
      title: "🤖 Buy an API (agents & developers)", sub: "Three ways, from quickest to production-ready.",
      optA: "Option A — Try in browser (no code)",
      optADesc: 'Open any service in the Marketplace, click "Try it now", and watch the full 402 → pay → data flow. Demo wallet — free, no login.',
      optB: "Option B — Raw HTTP (curl)", optBDesc: "Any HTTP-speaking language can buy. Pattern: call → 402 → pay → retry.",
      optC: "Option C — Node.js + Circle Gateway", optCDesc: "Circle Gateway client signs USDC payment and retries automatically. Set BUYER_PRIVATE_KEY (testnet wallet with USDC).",
      discover: "Discover all services and buy within a budget",
      discoverDesc: "Machine-readable catalog at /api/agent. An agent reads it, then pays for what it needs under a spending cap.",
      scripts: "Ready-made scripts: npm run agent (full catalog) and npm run demo:crypto (one service).",
    },
    sell: {
      title: "🏷️ List an API (sellers)", sub: "Anyone can list — no application, no waitlist, no KYC.",
      steps: [
        ["1. Host an x402 endpoint", "Your URL returns 402 + payment challenge without payment, then data once paid. Or list a free demo hosted on AuraGate."],
        ["2. Register it", "Submit via dashboard form or POST to /api/services. AuraGate health-checks your 402 response."],
        ["3. Get paid", "USDC lands in your wallet the moment an agent calls your endpoint. Reputation score grows from real usage."],
      ],
      validTitle: "What makes a valid x402 endpoint?",
      validDesc: "Without payment: return 402 with a JSON body containing an accepts array. Each entry needs: scheme, network, asset (USDC contract address), amount (atomic USDC, 6 decimals), and payTo (your wallet). Once paid: return 200 + your data.",
      testTitle: "Test before you list",
      testDesc: 'Use "Test endpoint" on the dashboard or POST to /api/services/probe. Returns a checklist of what passes and what to fix.',
      dashTitle: "Option A — Dashboard form (easiest)",
      dashDesc: "Go to Seller dashboard, fill the form, click Test endpoint to verify, then submit. Leave URL blank for a free AuraGate-hosted demo endpoint.",
      apiTitle: "Option B — Register via API", apiDesc: "POST your service definition to /api/services:",
      fieldTitle: "Field reference",
      fields: [
        ["price", 'USDC per request as a decimal string (e.g. "0.002" = $0.002).'],
        ["sellerAddress", "Wallet address that receives USDC on every purchase."],
        ["externalUrl", "Your x402 endpoint URL. Omit to host a free demo on AuraGate."],
        ["method", "GET or POST."],
        ["tags / docsUrl / sampleResponse", "Optional — shown on your service detail page."],
      ],
    },
    withdraw: {
      title: "💰 Withdraw funds (sellers)", sub: "USDC goes directly to your wallet on every purchase — AuraGate holds nothing.",
      direct: "How payment reaches you",
      directDesc: "When an agent buys your service, x402 transfers USDC directly from the buyer's wallet to the sellerAddress you registered. No escrow, no intermediary, no withdrawal step. Money is yours the moment the transaction settles on Arc (under 1 second).",
      circle: "If you use a Circle wallet",
      circleDesc: "Connect via the top-right login button. Once connected, click your address to open the Wallet Panel — view USDC balance and send to any address on Arc Testnet.",
      steps: [
        ["1. Connect wallet", "Click the top-right login → sign in with Google or Email → Circle wallet address appears."],
        ["2. Open Wallet Panel", "Click your wallet address (top-right) to see your USDC balance."],
        ["3. Send USDC", "Enter destination address and amount → click Send → approve the Circle SDK challenge."],
      ],
      note: "Circle wallets are Arc Testnet only (no real funds). For production, use any EVM wallet address as sellerAddress and collect USDC directly there.",
    },
    catalog: { pre: "📚 All ", post: " services", sub: "Every service is live data from a real source. Click to view & try.", cols: ["Service", "Seller", "Method", "Price"], apiLink: "Machine-readable catalog at" },
  },

  vi: {
    badge: "Tài liệu",
    title: "AuraGate hoạt động như thế nào",
    subtitle: "Chợ mở để AI agent trả phí API bằng USDC — từng request, không subscription, không API key. Hướng dẫn: mua API, bán API và rút tiền.",
    nav: { buy: "🤖 Mua API", sell: "🏷️ Đăng bán API", withdraw: "💰 Rút tiền", flow: "🔄 Luồng x402", catalog: "📚 Tất cả dịch vụ" },
    flow: {
      title: "🔄 Luồng thanh toán x402", sub: "Quá trình diễn ra trong mỗi lần mua — bốn bước.",
      steps: [
        ["1. Gửi yêu cầu", "Agent gọi URL dịch vụ. Server trả 402 Payment Required kèm giá, địa chỉ nhận và mạng."],
        ["2. Thanh toán", "Agent ký USDC authorization (EIP-3009) đúng số tiền và retry kèm header X-PAYMENT."],
        ["3. Settle", "AuraGate xác minh và thanh toán USDC qua Circle Gateway trong dưới 1 giây — không cần gas."],
        ["4. Nhận kết quả", "Agent nhận data kèm receipt on-chain (x-receipt-id, x-result-hash, x-settlement-tx)."],
      ],
    },
    buy: {
      title: "🤖 Mua API (agent & developer)", sub: "Ba cách, từ nhanh nhất đến production.",
      optA: "Cách A — Thử ngay trên trình duyệt (không cần code)",
      optADesc: 'Mở dịch vụ bất kỳ trong Registry, bấm "Try it now", xem toàn bộ luồng 402 → thanh toán → data. Ví demo, miễn phí, không cần đăng nhập.',
      optB: "Cách B — HTTP thuần (curl)", optBDesc: "Mọi ngôn ngữ hỗ trợ HTTP đều mua được. Quy trình: gọi → nhận 402 → thanh toán → gọi lại.",
      optC: "Cách C — Node.js + Circle Gateway", optCDesc: "Client Circle Gateway tự ký USDC và retry cho bạn. Set BUYER_PRIVATE_KEY (ví testnet có USDC).",
      discover: "Khám phá catalog và mua trong ngân sách",
      discoverDesc: "Catalog machine-readable tại /api/agent. Agent đọc catalog rồi tự chọn mua dịch vụ trong hạn mức chi tiêu.",
      scripts: "Script có sẵn: npm run agent (toàn bộ catalog) và npm run demo:crypto (một dịch vụ).",
    },
    sell: {
      title: "🏷️ Đăng bán API (seller)", sub: "Ai cũng đăng được — không cần xin phép, không waitlist, không KYC.",
      steps: [
        ["1. Host endpoint x402", "URL trả 402 + payment challenge khi chưa có payment, trả data khi đã thanh toán. Hoặc dùng demo miễn phí trên AuraGate."],
        ["2. Đăng ký", "Submit qua form dashboard hoặc POST đến /api/services. AuraGate tự kiểm tra response 402."],
        ["3. Nhận USDC", "USDC vào ví bạn ngay khi agent gọi endpoint. Điểm reputation tăng theo lượt mua thực tế."],
      ],
      validTitle: "Endpoint x402 hợp lệ trông như thế nào?",
      validDesc: "Khi không có payment: trả 402 với body JSON chứa mảng accepts. Mỗi phần tử cần: scheme, network, asset (địa chỉ USDC), amount (atomic, 6 số thập phân), payTo (ví của bạn). Khi đã thanh toán: trả 200 + data.",
      testTitle: "Kiểm tra trước khi đăng",
      testDesc: 'Dùng nút "Test endpoint" trên dashboard hoặc POST đến /api/services/probe. Nhận checklist chi tiết.',
      dashTitle: "Cách A — Form dashboard (dễ nhất)",
      dashDesc: "Vào Seller dashboard, điền form, bấm Test endpoint để kiểm tra, rồi submit. Để trống URL để dùng endpoint demo miễn phí trên AuraGate.",
      apiTitle: "Cách B — Đăng ký qua API", apiDesc: "POST định nghĩa dịch vụ đến /api/services:",
      fieldTitle: "Giải thích các trường",
      fields: [
        ["price", 'USDC mỗi request dạng chuỗi thập phân (vd "0.002" = $0.002).'],
        ["sellerAddress", "Địa chỉ ví nhận USDC sau mỗi lần mua."],
        ["externalUrl", "URL endpoint x402 của bạn. Để trống để host demo miễn phí trên AuraGate."],
        ["method", "GET hoặc POST."],
        ["tags / docsUrl / sampleResponse", "Tùy chọn — hiển thị trên trang chi tiết dịch vụ."],
      ],
    },
    withdraw: {
      title: "💰 Rút tiền (seller)", sub: "USDC vào ví bạn ngay khi mỗi lần mua — AuraGate không giữ tiền.",
      direct: "Tiền đến ví bạn như thế nào",
      directDesc: "Khi agent mua dịch vụ của bạn, giao thức x402 chuyển USDC trực tiếp từ ví người mua vào sellerAddress bạn đã đăng ký. Không escrow, không trung gian, không cần bước rút tiền. Tiền là của bạn ngay khi giao dịch settle trên Arc (dưới 1 giây).",
      circle: "Nếu bạn dùng ví Circle",
      circleDesc: "Kết nối ví Circle qua nút đăng nhập góc trên phải. Sau khi kết nối, bấm vào địa chỉ ví để mở Wallet Panel — xem số dư USDC và chuyển tiền đến bất kỳ địa chỉ nào trên Arc Testnet.",
      steps: [
        ["1. Kết nối ví", "Bấm nút đăng nhập góc trên → đăng nhập bằng Google hoặc Email → địa chỉ ví Circle xuất hiện."],
        ["2. Mở Wallet Panel", "Bấm vào địa chỉ ví (góc trên) để xem số dư USDC."],
        ["3. Gửi USDC", "Nhập địa chỉ đích và số tiền → bấm Send → xác nhận qua Circle SDK."],
      ],
      note: "Ví Circle chỉ trên Arc Testnet (không phải tiền thật). Khi production, dùng bất kỳ địa chỉ EVM nào làm sellerAddress và nhận USDC trực tiếp tại đó.",
    },
    catalog: { pre: "📚 ", post: " dịch vụ", sub: "Mỗi dịch vụ là dữ liệu thật từ nguồn thật. Bấm để xem chi tiết và thử.", cols: ["Dịch vụ", "Seller", "Method", "Giá"], apiLink: "Phiên bản machine-readable tại" },
  },

  zh: {
    badge: "文档",
    title: "AuraGate 使用指南",
    subtitle: "AI Agent 按请求用 USDC 付费的开放 API 市场——无需订阅，无需 API Key。本页涵盖：购买 API、出售 API 和提取资金。",
    nav: { buy: "🤖 购买 API", sell: "🏷️ 上架 API", withdraw: "💰 提取资金", flow: "🔄 x402 流程", catalog: "📚 所有服务" },
    flow: {
      title: "🔄 x402 支付流程", sub: "每次购买的完整流程——四个步骤。",
      steps: [
        ["1. 发起请求", "Agent 调用服务 URL，服务器返回 402 Payment Required，含价格、收款地址和网络信息。"],
        ["2. 付款", "Agent 签署 USDC 授权（EIP-3009）并携带 X-PAYMENT 头重试。"],
        ["3. 结算", "AuraGate 通过 Circle Gateway 在 1 秒内完成 USDC 验证和结算，无 Gas 费。"],
        ["4. 接收数据", "Agent 收到数据和链上收据（x-receipt-id、x-result-hash、x-settlement-tx）。"],
      ],
    },
    buy: {
      title: "🤖 购买 API（Agent & 开发者）", sub: "三种方式，从最快到生产就绪。",
      optA: "方式 A — 在浏览器中试用（无需代码）",
      optADesc: '在 Registry 中打开服务，点击 "Try it now"，实时查看 402 → 付款 → 获取数据流程。演示钱包，免费，无需登录。',
      optB: "方式 B — 原生 HTTP（curl）", optBDesc: "支持 HTTP 的任何语言都能购买。固定模式：调用 → 收到 402 → 付款 → 重试。",
      optC: "方式 C — Node.js + Circle Gateway", optCDesc: "Circle Gateway 客户端自动签署 USDC 付款并重试。设置 BUYER_PRIVATE_KEY（有 USDC 余额的测试网钱包）。",
      discover: "发现所有服务并在预算内购买",
      discoverDesc: "机器可读目录位于 /api/agent。Agent 读取后在花费上限内自动购买所需服务。",
      scripts: "现成脚本：npm run agent（购买全部目录）和 npm run demo:crypto（单个服务）。",
    },
    sell: {
      title: "🏷️ 上架 API（卖家）", sub: "任何人都可以上架——无需申请、无等待名单、无 KYC。",
      steps: [
        ["1. 托管 x402 端点", "URL 在无支付时返回 402 + 支付挑战，付款后返回数据。也可使用 AuraGate 提供的免费演示端点。"],
        ["2. 注册", "通过 Dashboard 表单或 POST 到 /api/services 注册。AuraGate 自动验证 402 响应。"],
        ["3. 收款", "Agent 调用端点时，USDC 立即到账您的钱包。信誉分数随真实使用量增长。"],
      ],
      validTitle: "什么是有效的 x402 端点？",
      validDesc: "无支付时：返回带 JSON 体的 402，其中 accepts 数组每项需要 scheme、network、asset（USDC 合约地址）、amount（原子单位，6位小数）和 payTo（您的钱包）。付款后返回 200 + 数据。",
      testTitle: "上架前先测试",
      testDesc: '使用 Dashboard 上的 "Test endpoint" 按钮，或 POST 到 /api/services/probe。获取详细检查清单。',
      dashTitle: "方式 A — Dashboard 表单（最简单）",
      dashDesc: "前往卖家 Dashboard，填写表单，点击 Test endpoint 验证，然后提交。URL 留空可在 AuraGate 上获得免费演示端点。",
      apiTitle: "方式 B — 通过 API 注册", apiDesc: "POST 服务定义到 /api/services：",
      fieldTitle: "字段说明",
      fields: [
        ["price", '每次请求的 USDC，字符串格式（如 "0.002" = $0.002）。'],
        ["sellerAddress", "接收 USDC 的钱包地址。"],
        ["externalUrl", "您的 x402 端点 URL。留空则在 AuraGate 创建免费演示端点。"],
        ["method", "GET 或 POST。"],
        ["tags / docsUrl / sampleResponse", "可选——显示在服务详情页面。"],
      ],
    },
    withdraw: {
      title: "💰 提取资金（卖家）", sub: "每次购买时 USDC 直接到达您的钱包——AuraGate 不持有任何资金。",
      direct: "资金如何到达您的钱包",
      directDesc: "当 Agent 购买您的服务时，x402 协议将 USDC 从买家钱包直接转入您注册的 sellerAddress。没有托管、没有中间保管、无需提现。Arc 上结算后（不到 1 秒）资金立即归您所有。",
      circle: "如果您使用 Circle 钱包",
      circleDesc: "通过右上角登录按钮连接 Circle 钱包。连接后，点击钱包地址打开 Wallet Panel，可查看 USDC 余额并向 Arc Testnet 上的任意地址转账。",
      steps: [
        ["1. 连接钱包", "点击右上角登录按钮 → 使用 Google 或 Email 登录 → Circle 钱包地址出现。"],
        ["2. 打开 Wallet Panel", "点击右上角钱包地址，查看 Arc Testnet 上的 USDC 余额。"],
        ["3. 发送 USDC", "输入目标地址和金额 → 点击 Send → 通过 Circle SDK 确认。"],
      ],
      note: "Circle 钱包仅在 Arc Testnet 上（非真实资金）。生产环境中，使用任意 EVM 钱包地址作为 sellerAddress，USDC 将直接到账该地址。",
    },
    catalog: { pre: "📚 全部 ", post: " 个服务", sub: "每个服务均来自真实数据源。点击查看详情并试用。", cols: ["服务", "卖家", "方法", "价格"], apiLink: "机器可读版本位于" },
  },

  ja: {
    badge: "ドキュメント",
    title: "AuraGateの仕組み",
    subtitle: "AIエージェントがUSDCでAPIをリクエストごとに支払うオープンマーケット。サブスクリプション不要、APIキー不要。購入・販売・出金の方法を解説します。",
    nav: { buy: "🤖 APIを購入", sell: "🏷️ APIを出品", withdraw: "💰 資金を引き出す", flow: "🔄 x402フロー", catalog: "📚 全サービス" },
    flow: {
      title: "🔄 x402支払いフロー", sub: "購入ごとのフロー——4つのステップ。",
      steps: [
        ["1. リクエスト", "エージェントがサービスURLを呼び出す。サーバーは402を返し、価格・受取先・ネットワーク情報を含む。"],
        ["2. 支払い", "エージェントは正確な金額のUSDAC認証（EIP-3009）に署名し、X-PAYMENTヘッダーを付けて再リクエスト。"],
        ["3. 決済", "AuraGateはCircle Gatewayを通じて1秒以内にUSDCを検証・決済。ガス代不要。"],
        ["4. データ受信", "エージェントはデータとオンチェーンレシートを受け取る。"],
      ],
    },
    buy: {
      title: "🤖 APIを購入する（エージェント＆開発者）", sub: "3つの方法。最も手軽なものから本番対応まで。",
      optA: "方法A — ブラウザで試す（コード不要）",
      optADesc: 'Registryでサービスを開き、"Try it now"をクリックして402→支払い→データ取得のフローをリアルタイムで確認。デモウォレット使用、無料・ログイン不要。',
      optB: "方法B — 生HTTP（curl）", optBDesc: "HTTPをサポートするあらゆる言語で購入可能。パターン：呼び出し→402受信→支払い→再試行。",
      optC: "方法C — Node.js + Circle Gateway", optCDesc: "Circle GatewayクライアントがUSDAC支払いに署名して自動再試行。BUYER_PRIVATE_KEY（USDC残高のあるテストネットウォレット）を設定。",
      discover: "全カタログを探索して予算内で購入",
      discoverDesc: "/api/agentに機械可読カタログがあります。エージェントが読み込み、支出上限内で必要なサービスを購入します。",
      scripts: "既製スクリプト：npm run agent（全カタログ）、npm run demo:crypto（1サービス）。",
    },
    sell: {
      title: "🏷️ APIを出品する（セラー）", sub: "誰でも出品可能——申請不要、ウェイトリスト不要、KYC不要。",
      steps: [
        ["1. x402エンドポイントをホスト", "URLは未払い時に402+支払いチャレンジを返し、支払い後にデータを返す。AuraGateの無料デモエンドポイントも利用可能。"],
        ["2. 登録", "Dashboardフォームから送信、または/api/servicesにPOST。AuraGateが自動的に402レスポンスを検証。"],
        ["3. 報酬を受け取る", "エージェントがエンドポイントを呼び出した瞬間、USDCがウォレットに届く。実使用から評判スコアが向上。"],
      ],
      validTitle: "有効なx402エンドポイントとは？",
      validDesc: "支払いなし時：acceptsを含むJSON体の402を返す。各エントリーには scheme、network、asset（USDCコントラクト）、amount（アトミック、6桁）、payTo（ウォレット）が必要。支払い後は200+データを返す。",
      testTitle: "出品前にテスト",
      testDesc: 'Dashboardの"Test endpoint"ボタン、または/api/services/probeへのPOSTでテスト。詳細チェックリストを取得。',
      dashTitle: "方法A — Dashboardフォーム（最も簡単）",
      dashDesc: "セラーDashboardでフォームに入力し、Test endpointで検証後、送信。URLを空白にするとAuraGate上の無料デモエンドポイントを取得。",
      apiTitle: "方法B — APIで登録", apiDesc: "サービス定義を/api/servicesにPOST：",
      fieldTitle: "フィールド説明",
      fields: [
        ["price", '1リクエストあたりのUSDAC、小数文字列（例："0.002" = $0.002）。'],
        ["sellerAddress", "USDCを受け取るウォレットアドレス。"],
        ["externalUrl", "x402エンドポイントURL。空白の場合、AuraGateにデモエンドポイントを作成。"],
        ["method", "GETまたはPOST。"],
        ["tags / docsUrl / sampleResponse", "任意——サービス詳細ページに表示。"],
      ],
    },
    withdraw: {
      title: "💰 資金を引き出す（セラー）", sub: "購入ごとにUSDCが直接ウォレットに届く——AuraGateは資金を保有しない。",
      direct: "資金がウォレットに届く仕組み",
      directDesc: "エージェントがサービスを購入すると、x402プロトコルが買い手ウォレットから登録したsellerAddressに直接USDCを転送。エスクローなし、仲介者なし、引き出しステップなし。Arc上で決済後（1秒未満）すぐに資金はあなたのもの。",
      circle: "Circle ウォレットを使用する場合",
      circleDesc: "右上のログインボタンからCircleウォレットを接続。接続後、ウォレットアドレスをクリックしてWallet Panelを開き、USDC残高の確認とArc Testnet上の任意アドレスへの送金が可能。",
      steps: [
        ["1. ウォレットを接続", "右上のログインボタン→GoogleまたはEmailでサインイン→Circleウォレットアドレスが表示。"],
        ["2. Wallet Panelを開く", "右上のウォレットアドレスをクリックしてUSDC残高を確認。"],
        ["3. USDCを送金", "送金先アドレスと金額を入力→Send→Circle SDKで承認。"],
      ],
      note: "CircleウォレットはArc Testnetのみ（実際の資金ではない）。本番環境では任意のEVMウォレットアドレスをsellerAddressとして使用。",
    },
    catalog: { pre: "📚 全 ", post: " サービス", sub: "各サービスはリアルデータソースから取得。クリックして詳細を確認・試用。", cols: ["サービス", "セラー", "メソッド", "価格"], apiLink: "機械可読バージョン：" },
  },

  ko: {
    badge: "문서",
    title: "AuraGate 사용 가이드",
    subtitle: "AI 에이전트가 USDC로 API를 요청당 결제하는 오픈 마켓플레이스. 구독 불필요, API 키 불필요. API 구매·판매·출금 방법을 안내합니다.",
    nav: { buy: "🤖 API 구매", sell: "🏷️ API 등록", withdraw: "💰 자금 출금", flow: "🔄 x402 흐름", catalog: "📚 전체 서비스" },
    flow: {
      title: "🔄 x402 결제 흐름", sub: "매 구매 시 발생하는 과정 — 4단계.",
      steps: [
        ["1. 요청", "에이전트가 서비스 URL을 호출. 서버는 402와 함께 가격, 수신 주소, 네트워크 정보를 반환."],
        ["2. 결제", "에이전트가 정확한 금액에 USDC 승인(EIP-3009)에 서명하고 X-PAYMENT 헤더와 함께 재시도."],
        ["3. 정산", "AuraGate가 Circle Gateway를 통해 1초 이내에 USDC를 검증 및 정산. Gas 수수료 없음."],
        ["4. 데이터 수신", "에이전트가 데이터와 온체인 영수증(x-receipt-id, x-result-hash, x-settlement-tx)을 수신."],
      ],
    },
    buy: {
      title: "🤖 API 구매 (에이전트 & 개발자)", sub: "세 가지 방법 — 가장 빠른 것부터 프로덕션까지.",
      optA: "방법 A — 브라우저에서 바로 체험 (코드 불필요)",
      optADesc: 'Registry에서 서비스를 열고 "Try it now"를 클릭하면 402 → 결제 → 데이터 수신 흐름을 실시간으로 확인. 데모 지갑 사용, 무료, 로그인 불필요.',
      optB: "방법 B — HTTP 직접 호출 (curl)", optBDesc: "HTTP를 지원하는 모든 언어로 구매 가능. 패턴: 호출 → 402 수신 → 결제 → 재시도.",
      optC: "방법 C — Node.js + Circle Gateway", optCDesc: "Circle Gateway 클라이언트가 USDC 결제 서명과 재시도를 자동 처리. BUYER_PRIVATE_KEY(테스트넷 지갑) 설정 필요.",
      discover: "전체 카탈로그를 탐색하고 예산 내에서 구매",
      discoverDesc: "/api/agent에 기계 가독 카탈로그가 있습니다. 에이전트가 카탈로그를 읽고 지출 한도 내에서 구매합니다.",
      scripts: "기성 스크립트: npm run agent(전체 카탈로그), npm run demo:crypto(단일 서비스).",
    },
    sell: {
      title: "🏷️ API 등록 (판매자)", sub: "누구나 등록 가능 — 신청서, 대기자 명단, KYC 불필요.",
      steps: [
        ["1. x402 엔드포인트 호스팅", "URL은 결제 없을 때 402 + 결제 챌린지를 반환하고, 결제 후 데이터 반환. 또는 AuraGate의 무료 데모 엔드포인트 사용 가능."],
        ["2. 등록", "Dashboard 양식으로 제출하거나 /api/services에 POST. AuraGate가 자동으로 402 응답을 검증."],
        ["3. 수익 수령", "에이전트가 엔드포인트를 호출하는 즉시 USDC가 지갑에 도착. 평판 점수 향상."],
      ],
      validTitle: "유효한 x402 엔드포인트란?",
      validDesc: "결제 없이 호출될 때 accepts 배열이 포함된 JSON 본문의 402를 반환. 각 항목에는 scheme, network, asset(USDC 컨트랙트), amount(원자 단위, 6자리), payTo(지갑 주소)가 필요. 결제 후 200 + 데이터 반환.",
      testTitle: "등록 전 테스트",
      testDesc: 'Dashboard의 "Test endpoint" 버튼 또는 /api/services/probe에 POST. 상세 체크리스트 제공.',
      dashTitle: "방법 A — Dashboard 양식 (가장 쉬운 방법)",
      dashDesc: "판매자 Dashboard에서 양식 작성 → Test endpoint로 검증 → 제출. URL을 비워두면 AuraGate에서 무료 데모 엔드포인트 제공.",
      apiTitle: "방법 B — API로 등록", apiDesc: "/api/services에 서비스 정의를 POST:",
      fieldTitle: "필드 설명",
      fields: [
        ["price", '요청당 USDC, 소수 문자열 (예: "0.002" = $0.002).'],
        ["sellerAddress", "USDC를 수령할 지갑 주소."],
        ["externalUrl", "x402 엔드포인트 URL. 비워두면 AuraGate에 데모 엔드포인트 생성."],
        ["method", "GET 또는 POST."],
        ["tags / docsUrl / sampleResponse", "선택 사항 — 서비스 상세 페이지에 표시."],
      ],
    },
    withdraw: {
      title: "💰 자금 출금 (판매자)", sub: "구매마다 USDC가 직접 지갑으로 — AuraGate는 자금을 보유하지 않습니다.",
      direct: "자금이 지갑에 도착하는 방법",
      directDesc: "에이전트가 서비스를 구매하면 x402 프로토콜이 구매자 지갑에서 등록된 sellerAddress로 직접 USDC를 전송합니다. 에스크로 없음, 중개 보관 없음, 출금 단계 없음. Arc에서 정산 후(1초 미만) 즉시 자금은 귀하의 것입니다.",
      circle: "Circle 지갑을 사용하는 경우",
      circleDesc: "오른쪽 상단 로그인 버튼으로 Circle 지갑 연결. 연결 후 지갑 주소를 클릭하여 Wallet Panel 열기 — USDC 잔액 확인 및 Arc Testnet의 모든 주소로 전송 가능.",
      steps: [
        ["1. 지갑 연결", "오른쪽 상단 로그인 버튼 → Google 또는 Email로 로그인 → Circle 지갑 주소 표시."],
        ["2. Wallet Panel 열기", "오른쪽 상단 지갑 주소 클릭 → USDC 잔액 확인."],
        ["3. USDC 전송", "목적지 주소와 금액 입력 → Send 클릭 → Circle SDK로 승인."],
      ],
      note: "Circle 지갑은 Arc Testnet 전용입니다(실제 자금 아님). 프로덕션에서는 EVM 지갑 주소를 sellerAddress로 사용하면 USDC가 직접 도착합니다.",
    },
    catalog: { pre: "📚 전체 ", post: " 개 서비스", sub: "모든 서비스는 실제 소스의 라이브 데이터입니다. 클릭하여 상세 확인 및 체험.", cols: ["서비스", "판매자", "방법", "가격"], apiLink: "기계 가독 카탈로그:" },
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "🇬🇧 English",
  vi: "🇻🇳 Tiếng Việt",
  zh: "🇨🇳 中文",
  ja: "🇯🇵 日本語",
  ko: "🇰🇷 한국어",
};

function Section({ id, title, sub, children }: { id: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-20">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{sub}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Code({ code, label }: { code: string; label?: string }) {
  return (
    <div className="card mt-3 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">{label ?? "code"}</span>
        <CopyButton text={code} label="copy" />
      </div>
      <pre className="overflow-x-auto bg-bg p-4 font-mono text-xs leading-relaxed text-mint">{code}</pre>
    </div>
  );
}

export type ServiceItem = { slug: string; name: string; sellerName: string; method: string; price: string };

export function DocsContent({ services, base }: { services: ServiceItem[]; base: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = T[lang];

  const exSlug = (services.find((s) => s.slug === "oracle-check") ?? services[0])?.slug ?? "oracle-check";
  const exUrl = `${base}/api/premium/${exSlug}`;

  const curlCode = `# Step 1 — Hit the endpoint, receive 402
curl -i ${exUrl} -H "x-payer: 0xYourWalletAddress"

# Step 2 — Sign USDC authorization and retry
curl -X GET ${exUrl} \\
  -H "X-PAYMENT: <signed-eip3009-authorization>" \\
  -H "X-PAYER: 0xYourWalletAddress"
# → 200 OK + JSON data + x-receipt-id`;

  const jsCode = `// my-agent.mjs — buy from AuraGate (Node 18+)
const endpoint = "${exUrl}";

// Step 1: first call → 402
const first = await fetch(endpoint);
console.log("Status:", first.status); // 402

// Step 2: pay via Circle Gateway, auto-retry
const { GatewayClient } = await import("@circle-fin/x402-batching/client");
const gw = new GatewayClient({ chain: "arcTestnet", privateKey: process.env.BUYER_PRIVATE_KEY });
await gw.deposit("0.10");             // fund gateway once
const { data } = await gw.pay(endpoint);
console.log("Data:", data);`;

  const budgetCode = `const catalog = await fetch("${base}/api/agent").then(r => r.json());
let spent = 0, budget = 0.10;
for (const svc of catalog.services) {
  if (spent + Number(svc.price.amount) > budget) continue;
  const { data } = await gw.pay(svc.url);
  console.log(svc.name, "→", data);
  spent += Number(svc.price.amount);
}`;

  const endpointCode = `// x402 endpoint — Next.js / Express / any HTTP server
export async function GET(req) {
  if (!req.headers.get("x-payment")) {
    return Response.json({
      x402Version: 2,
      accepts: [{
        scheme: "exact",
        network: "eip155:5042002",       // Arc Testnet
        asset: "0x<USDC-on-Arc>",
        amount: "2000",                   // $0.002 (6 decimals)
        payTo: "0xYourSellerWallet",
        maxTimeoutSeconds: 60
      }],
      error: "Payment required"
    }, { status: 402 });
  }
  return Response.json({ result: "your data here" });
}`;

  const probeCode = `curl -X POST ${base}/api/services/probe \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://my-api.com/endpoint", "method": "GET", "price": "0.002" }'
# → { "ok": true, "checks": [ ... ] }`;

  const registerCode = `curl -X POST ${base}/api/services \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Weather API",
    "description": "Live weather, pay-per-call.",
    "category": "data",
    "price": "0.002",
    "method": "GET",
    "sellerName": "MyCompany",
    "sellerAddress": "0xYourWalletAddress",
    "externalUrl": "https://my-api.com/x402/weather",
    "docsUrl": "https://my-api.com/docs",
    "tags": ["weather", "realtime"],
    "sampleResponse": { "city": "Hanoi", "temp": 31 }
  }'`;

  return (
    <div className="container-page py-10">
      {/* Language switcher */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              lang === l ? "bg-primary text-white" : "text-muted hover:text-ink"
            }`}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="mt-6 max-w-3xl">
        <span className="badge">{t.badge}</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="mt-3 text-muted">{t.subtitle}</p>
      </div>

      {/* Quick nav */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(["#buy", "#sell", "#withdraw", "#flow", "#catalog"] as const).map((href, i) => {
          const labels = [t.nav.buy, t.nav.sell, t.nav.withdraw, t.nav.flow, t.nav.catalog];
          return <a key={href} href={href} className="badge hover:!text-ink">{labels[i]}</a>;
        })}
      </div>

      {/* x402 flow */}
      <Section id="flow" title={t.flow.title} sub={t.flow.sub}>
        <ol className="grid gap-3 sm:grid-cols-2">
          {t.flow.steps.map(([title, desc]) => (
            <li key={title} className="card p-4">
              <p className="font-semibold text-primary">{title}</p>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Buy */}
      <Section id="buy" title={t.buy.title} sub={t.buy.sub}>
        <h3 className="mt-2 font-semibold">{t.buy.optA}</h3>
        <p className="mt-1 text-sm text-muted">
          {t.buy.optADesc}{" "}
          <Link href="/services" className="text-primary hover:underline">Registry →</Link>
        </p>

        <h3 className="mt-6 font-semibold">{t.buy.optB}</h3>
        <p className="mt-1 text-sm text-muted">{t.buy.optBDesc}</p>
        <Code code={curlCode} label="curl" />

        <h3 className="mt-6 font-semibold">{t.buy.optC}</h3>
        <p className="mt-1 text-sm text-muted">{t.buy.optCDesc}</p>
        <Code code={jsCode} label="my-agent.mjs" />

        <h3 className="mt-6 font-semibold">{t.buy.discover}</h3>
        <p className="mt-1 text-sm text-muted">{t.buy.discoverDesc}</p>
        <Code code={budgetCode} label="budget loop" />
        <p className="mt-3 text-sm text-muted">{t.buy.scripts}</p>
      </Section>

      {/* Sell */}
      <Section id="sell" title={t.sell.title} sub={t.sell.sub}>
        <div className="grid gap-3 sm:grid-cols-3">
          {t.sell.steps.map(([title, desc]) => (
            <div key={title} className="card p-4">
              <p className="font-semibold text-primary">{title}</p>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 font-semibold">{t.sell.validTitle}</h3>
        <p className="mt-1 text-sm text-muted">{t.sell.validDesc}</p>
        <Code code={endpointCode} label="x402 endpoint" />

        <h3 className="mt-6 font-semibold">{t.sell.testTitle}</h3>
        <p className="mt-1 text-sm text-muted">{t.sell.testDesc}</p>
        <Code code={probeCode} label="probe" />

        <h3 className="mt-6 font-semibold">{t.sell.dashTitle}</h3>
        <p className="mt-1 text-sm text-muted">
          {t.sell.dashDesc}{" "}
          <Link href="/dashboard" className="text-primary hover:underline">Dashboard →</Link>
        </p>

        <h3 className="mt-6 font-semibold">{t.sell.apiTitle}</h3>
        <p className="mt-1 text-sm text-muted">{t.sell.apiDesc}</p>
        <Code code={registerCode} label="register" />

        <div className="card mt-4 p-4 text-sm text-muted">
          <p className="font-semibold text-ink">{t.sell.fieldTitle}</p>
          <ul className="mt-2 space-y-1.5">
            {t.sell.fields.map(([field, desc]) => (
              <li key={field}>
                <code className="text-ink">{field}</code> — {desc}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Withdraw */}
      <Section id="withdraw" title={t.withdraw.title} sub={t.withdraw.sub}>
        <div className="card p-5">
          <p className="font-semibold text-ink">{t.withdraw.direct}</p>
          <p className="mt-2 text-sm text-muted">{t.withdraw.directDesc}</p>
        </div>

        <div className="card mt-4 p-5">
          <p className="font-semibold text-ink">{t.withdraw.circle}</p>
          <p className="mt-2 text-sm text-muted">{t.withdraw.circleDesc}</p>
          <ol className="mt-4 space-y-3">
            {t.withdraw.steps.map(([title, desc]) => (
              <li key={title} className="flex gap-3 text-sm">
                <span className="whitespace-nowrap font-semibold text-primary">{title}</span>
                <span className="text-muted">{desc}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 rounded-xl border border-amber/30 bg-amber/5 p-4 text-sm text-amber">
          {t.withdraw.note}
        </div>
      </Section>

      {/* Catalog */}
      <Section
        id="catalog"
        title={`${t.catalog.pre}${services.length}${t.catalog.post}`}
        sub={t.catalog.sub}
      >
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel2/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                {t.catalog.cols.map((col) => (
                  <th key={col} className="px-4 py-2.5">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.slug} className="border-t border-line/60 hover:bg-panel/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/services/${s.slug}`} className="font-medium hover:text-primary">{s.name}</Link>
                    <p className="text-xs text-muted">/api/premium/{s.slug}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{s.sellerName}</td>
                  <td className="px-4 py-2.5"><span className="badge">{s.method}</span></td>
                  <td className="px-4 py-2.5 text-right font-semibold text-mint">{usd(s.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          {t.catalog.apiLink}{" "}
          <a href="/api/agent" target="_blank" rel="noreferrer" className="text-primary hover:underline">/api/agent</a>
        </p>
      </Section>
    </div>
  );
}
