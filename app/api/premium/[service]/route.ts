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

    case "weather": {
      // City passed via ?city= ... defaults to a few majors; uses open-meteo (no key).
      const url = new URL(req.url);
      const city = (url.searchParams.get("city") ?? "hanoi").toLowerCase();
      const cities: Record<string, { lat: number; lon: number; name: string }> = {
        hanoi: { lat: 21.03, lon: 105.85, name: "Hanoi" },
        singapore: { lat: 1.35, lon: 103.82, name: "Singapore" },
        tokyo: { lat: 35.68, lon: 139.69, name: "Tokyo" },
        london: { lat: 51.51, lon: -0.13, name: "London" },
        newyork: { lat: 40.71, lon: -74.01, name: "New York" },
      };
      const loc = cities[city] ?? cities.hanoi;
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (r.ok) {
          const d = await r.json();
          const c = d.current ?? {};
          return {
            source: "open-meteo",
            generatedAt: now,
            city: loc.name,
            temperatureC: c.temperature_2m,
            humidityPct: c.relative_humidity_2m,
            windSpeedKmh: c.wind_speed_10m,
            observedAt: c.time,
          };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, city: loc.name, temperatureC: 28 };
    }

    case "fx-rates": {
      // Latest USD exchange rates from frankfurter.app (ECB data, no key).
      try {
        const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,VND,SGD,CNY", {
          signal: AbortSignal.timeout(4000),
        });
        if (r.ok) {
          const d = await r.json();
          return { source: "frankfurter/ECB", generatedAt: now, base: "USD", date: d.date, rates: d.rates };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, base: "USD", rates: { EUR: 0.92, VND: 25400 } };
    }

    case "ip-info": {
      const url = new URL(req.url);
      const ip = url.searchParams.get("ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      const endpoint = ip ? `http://ip-api.com/json/${ip}` : "http://ip-api.com/json/";
      try {
        const r = await fetch(
          `${endpoint}?fields=status,message,country,countryCode,region,city,zip,lat,lon,timezone,isp,org,query`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (r.ok) {
          const d = await r.json();
          if (d.status === "success") {
            return {
              source: "ip-api.com",
              generatedAt: now,
              ip: d.query,
              country: d.country,
              countryCode: d.countryCode,
              region: d.region,
              city: d.city,
              lat: d.lat,
              lon: d.lon,
              timezone: d.timezone,
              isp: d.isp,
              org: d.org,
            };
          }
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, ip: ip || "unknown", country: "Unknown", city: "Unknown" };
    }

    case "holidays": {
      const url = new URL(req.url);
      const country = (url.searchParams.get("country") ?? "US").toUpperCase().slice(0, 2);
      const year = new Date().getFullYear();
      try {
        const r = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/${country}`, {
          signal: AbortSignal.timeout(4000),
          headers: { Accept: "application/json" },
        });
        if (r.ok) {
          const data: Array<{ date: string; localName: string; name: string; countryCode: string; global: boolean }> = await r.json();
          return {
            source: "date.nager.at",
            generatedAt: now,
            country,
            year,
            count: data.length,
            holidays: data.slice(0, 15).map((h) => ({ date: h.date, name: h.localName, nameEn: h.name, global: h.global })),
          };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, country, year, holidays: [] };
    }

    case "country-info": {
      const url = new URL(req.url);
      const country = url.searchParams.get("country") ?? "Vietnam";
      try {
        const r = await fetch(
          `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=name,capital,population,region,subregion,currencies,languages,flags,area,timezones`,
          { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } }
        );
        if (r.ok) {
          const data = await r.json();
          const c = data[0];
          return {
            source: "restcountries.com",
            generatedAt: now,
            name: c.name?.common,
            officialName: c.name?.official,
            capital: c.capital?.[0],
            population: c.population,
            region: c.region,
            subregion: c.subregion,
            area: c.area,
            currencies: c.currencies,
            languages: c.languages,
            timezones: c.timezones,
            flag: c.flags?.emoji,
          };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, name: country, population: 0 };
    }

    case "mempool": {
      try {
        const [feesRes, heightRes] = await Promise.all([
          fetch("https://mempool.space/api/v1/fees/recommended", { signal: AbortSignal.timeout(5000) }),
          fetch("https://mempool.space/api/blocks/tip/height", { signal: AbortSignal.timeout(5000) }),
        ]);
        const fees = feesRes.ok ? await feesRes.json() : null;
        const blockHeight = heightRes.ok ? Number(await heightRes.text()) : null;
        if (fees) {
          return {
            source: "mempool.space",
            generatedAt: now,
            blockHeight,
            fees: {
              fastestSat: fees.fastestFee,
              halfHourSat: fees.halfHourFee,
              hourSat: fees.hourFee,
              economySat: fees.economyFee,
              minimumSat: fees.minimumFee,
            },
            interpretation: `Fastest: ${fees.fastestFee} sat/vB · Economy: ${fees.economyFee} sat/vB`,
          };
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, fees: { fastestSat: 20, economySat: 4 }, blockHeight: null };
    }

    case "joke": {
      try {
        const r = await fetch("https://v2.jokeapi.dev/joke/Programming,Misc?type=single&safe-mode", {
          signal: AbortSignal.timeout(4000),
          headers: { Accept: "application/json" },
        });
        if (r.ok) {
          const d = await r.json();
          if (!d.error) {
            return { source: "jokeapi.dev", generatedAt: now, category: d.category, joke: d.joke };
          }
        }
      } catch { /* fall through */ }
      return { source: "sample", generatedAt: now, category: "Programming", joke: "Why do programmers prefer dark mode? Because light attracts bugs." };
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
