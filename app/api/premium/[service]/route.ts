import { NextRequest, NextResponse } from "next/server";
import { getService, recordPayment, recordReceipt, updateReceiptOnchainTx } from "@/lib/store";
import { processPayment } from "@/lib/x402";
import { resultHash } from "@/lib/format";
import { writeReceiptOnChain } from "@/lib/onchain";
import { ARC } from "@/lib/arc";

export const dynamic = "force-dynamic";

async function produce(slug: string, fallback: unknown, req: NextRequest): Promise<unknown> {
  const now = new Date().toISOString();

  switch (slug) {
    case "market-insight": {
      const base = process.env.AURAPREDICT_INDEXER_URL ?? "https://api.aurapredict.xyz";
      try {
        const r = await fetch(`${base}/api/stats`, { signal: AbortSignal.timeout(2500) });
        if (r.ok) return { source: "aurapredict-indexer", generatedAt: now, stats: await r.json() };
      } catch { /* fall through */ }
      return { source: "aurapredict-sample", generatedAt: now, ...((fallback as object) ?? {}) };
    }

    case "oracle-check": {
      try {
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true",
          { signal: AbortSignal.timeout(4000), headers: { Accept: "application/json" } }
        );
        if (r.ok) {
          const d = await r.json();
          return {
            source: "coingecko",
            generatedAt: now,
            prices: {
              BTC: { usd: d.bitcoin?.usd, change24h: Number(d.bitcoin?.usd_24h_change?.toFixed(2)) },
              ETH: { usd: d.ethereum?.usd, change24h: Number(d.ethereum?.usd_24h_change?.toFixed(2)) },
              SOL: { usd: d.solana?.usd, change24h: Number(d.solana?.usd_24h_change?.toFixed(2)) },
            },
            confidence: 0.99,
            updatedAt: new Date((d.bitcoin?.last_updated_at ?? 0) * 1000).toISOString(),
          };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, ...((fallback as object) ?? {}) };
    }

    case "summarize": {
      let text = "";
      try {
        const body = await req.json();
        text = String(body?.text ?? "");
      } catch { /* no body or not JSON */ }
      if (!text) return { generatedAt: now, error: "Provide { text: '...' } in the request body." };

      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey) {
        try {
          const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
          const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              max_tokens: 300,
              messages: [{ role: "user", content: `Summarize in 3 concise bullet points:\n\n${text.slice(0, 3000)}` }],
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (r.ok) {
            const data = await r.json();
            return { source: "groq", model, generatedAt: now, summary: data.choices?.[0]?.message?.content ?? "", inputLength: text.length };
          }
        } catch { /* fall through */ }
      }
      // Basic extractive fallback — first 3 sentences
      const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
      return { source: "extractive", generatedAt: now, summary: sentences.slice(0, 3).join(" "), inputLength: text.length };
    }

    case "dataset": {
      try {
        const r = await fetch("https://api.alternative.me/fng/?limit=7", { signal: AbortSignal.timeout(4000) });
        if (r.ok) {
          const data = await r.json();
          return {
            source: "alternative.me/fng",
            generatedAt: now,
            current: data.data?.[0],
            history7d: (data.data ?? []).map((d: Record<string, string>) => ({
              date: new Date(Number(d.timestamp) * 1000).toISOString().split("T")[0],
              value: Number(d.value),
              label: d.value_classification,
            })),
          };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, ...((fallback as object) ?? {}) };
    }

    case "sentiment": {
      try {
        const r = await fetch("https://api.alternative.me/fng/", { signal: AbortSignal.timeout(4000) });
        if (r.ok) {
          const data = await r.json();
          const item = data.data?.[0];
          const score = Number(item?.value ?? 50);
          return {
            source: "alternative.me/fng",
            generatedAt: now,
            sentiment: item?.value_classification,
            score,
            signal: score < 25 ? "extreme_fear" : score < 45 ? "fear" : score < 55 ? "neutral" : score < 75 ? "greed" : "extreme_greed",
            interpretation: score < 25 ? "Extreme Fear — historically a buy signal for long-term holders." : score > 75 ? "Extreme Greed — market may be overheated, caution advised." : "Neutral sentiment — no strong directional bias.",
          };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, sentiment: "Neutral", score: 50 };
    }

    case "trending": {
      try {
        const r = await fetch("https://api.coingecko.com/api/v3/search/trending", {
          signal: AbortSignal.timeout(4000),
          headers: { Accept: "application/json" },
        });
        if (r.ok) {
          const data = await r.json();
          const coins = (data.coins ?? []).slice(0, 5).map((c: { item: Record<string, unknown> }) => ({
            rank: c.item.market_cap_rank,
            name: c.item.name,
            symbol: c.item.symbol,
            priceUsd: c.item.data ? (c.item.data as Record<string, unknown>).price : undefined,
            change24h: c.item.data ? (c.item.data as Record<string, unknown>).price_change_percentage_24h : undefined,
          }));
          return { source: "coingecko/trending", generatedAt: now, coins };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, coins: [] };
    }

    default:
      return { generatedAt: now, data: fallback };
  }
}

async function handle(req: NextRequest, slug: string) {
  const service = await getService(slug);
  if (!service || !service.active) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const payTo = /^0x[0-9a-fA-F]{40}$/.test(service.sellerAddress)
    ? service.sellerAddress
    : (process.env.SELLER_ADDRESS ?? "0x0000000000000000000000000000000000000000");
  const outcome = await processPayment(req, service.price, payTo);
  if (outcome.kind === "challenge") {
    return outcome.response;
  }
  const payment = outcome.payment;

  const body = await produce(slug, service.sampleResponse, req);
  const p = await recordPayment({
    serviceSlug: slug,
    buyerAddress: payment.payer,
    amount: payment.amount,
    status: "settled",
    txHash: payment.transaction,
    network: payment.network,
  });
  const hash = resultHash(body);
  const receipt = await recordReceipt({
    paymentId: p.id,
    serviceSlug: slug,
    payer: payment.payer,
    amount: payment.amount,
    resultHash: hash,
    onchainTx: payment.transaction,
  });

  writeReceiptOnChain({
    payer: payment.payer,
    serviceSlug: slug,
    amountUsd: payment.amount,
    resultHash: hash,
  }).then(async (tx) => {
    if (tx) {
      await updateReceiptOnchainTx(receipt.id, tx);
      console.log("[onchain] receipt tx:", tx);
    }
  });

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "x-payment-network": payment.network,
      "x-receipt-id": receipt.id,
      "x-result-hash": hash,
      ...(payment.transaction ? { "x-settlement-tx": payment.transaction } : {}),
      "x-arc-explorer": ARC.explorer,
      ...(outcome.responseHeaders ?? {}),
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  return handle(req, (await ctx.params).service);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  return handle(req, (await ctx.params).service);
}
