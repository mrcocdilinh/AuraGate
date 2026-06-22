/**
 * Service data providers.
 *
 * Each entry maps a service slug → an async function that fetches LIVE data
 * from a free, public, no-API-key source. Every provider is wrapped so that if
 * the upstream source is slow or down, the service still returns a sensible
 * `sample` payload (from the service's `sampleResponse`) instead of erroring.
 *
 * All sources here are free and keyless except `summarize` (optional GROQ key)
 * and `market-insight` (AuraPredict indexer).
 */
import type { NextRequest } from "next/server";

const TIMEOUT = 4500;
const UA = "AuraGate/1.0 (+https://auragate.app)";

interface Ctx {
  req: NextRequest;
  url: URL;
  now: string;
  fallback: unknown;
}

type Provider = (ctx: Ctx) => Promise<unknown>;

/** Fetch JSON; throw on non-2xx so the outer wrapper falls back to a sample. */
async function getJson(url: string, opts: RequestInit = {}): Promise<any> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { Accept: "application/json", "User-Agent": UA, ...(opts.headers ?? {}) },
    ...opts,
  });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return r.json();
}

const num = (v: unknown, d = 2) => (v == null ? null : Number(Number(v).toFixed(d)));

// City presets reused by weather / forecast / air-quality.
const CITIES: Record<string, { lat: number; lon: number; name: string }> = {
  hanoi: { lat: 21.03, lon: 105.85, name: "Hanoi" },
  saigon: { lat: 10.82, lon: 106.63, name: "Ho Chi Minh City" },
  singapore: { lat: 1.35, lon: 103.82, name: "Singapore" },
  tokyo: { lat: 35.68, lon: 139.69, name: "Tokyo" },
  london: { lat: 51.51, lon: -0.13, name: "London" },
  newyork: { lat: 40.71, lon: -74.01, name: "New York" },
  dubai: { lat: 25.2, lon: 55.27, name: "Dubai" },
};
const cityFrom = (url: URL) => CITIES[(url.searchParams.get("city") ?? "hanoi").toLowerCase()] ?? CITIES.hanoi;

// ─── Providers ───────────────────────────────────────────────────────────────

const providers: Record<string, Provider> = {
  // ═══ CRYPTO ═══════════════════════════════════════════════════════════════
  "market-insight": async ({ now, fallback }) => {
    const base = process.env.AURAPREDICT_INDEXER_URL ?? "https://api.aurapredict.xyz";
    const stats = await getJson(`${base}/api/stats`);
    return { source: "aurapredict-indexer", generatedAt: now, stats };
  },

  "oracle-check": async ({ url, now }) => {
    // ?coins=bitcoin,ethereum,... (CoinGecko ids). Defaults to BTC/ETH/SOL.
    const ids = (url.searchParams.get("coins") ?? "bitcoin,ethereum,solana")
      .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).slice(0, 25).join(",");
    const d = await getJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_last_updated_at=true`
    );
    const prices: Record<string, unknown> = {};
    for (const [id, v] of Object.entries<any>(d)) {
      prices[id] = { usd: v.usd, change24h: num(v.usd_24h_change), marketCap: v.usd_market_cap ? Math.round(v.usd_market_cap) : null };
    }
    return { source: "coingecko", generatedAt: now, confidence: 0.99, prices };
  },

  "price-multi-exchange": async ({ url, now }) => {
    // Same asset priced across 3 major exchanges so agents can spot arbitrage.
    const sym = (url.searchParams.get("symbol") ?? "BTC").toUpperCase();
    const [binance, coinbase, kraken] = await Promise.allSettled([
      getJson(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`).then((d) => Number(d.price)),
      getJson(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`).then((d) => Number(d.data.amount)),
      getJson(`https://api.kraken.com/0/public/Ticker?pair=${sym}USD`).then((d) => {
        const k = Object.keys(d.result)[0];
        return Number(d.result[k].c[0]);
      }),
    ]);
    const ex: Record<string, number | null> = {
      binance: binance.status === "fulfilled" ? binance.value : null,
      coinbase: coinbase.status === "fulfilled" ? coinbase.value : null,
      kraken: kraken.status === "fulfilled" ? kraken.value : null,
    };
    const vals = Object.values(ex).filter((v): v is number => typeof v === "number" && v > 0);
    const min = vals.length ? Math.min(...vals) : null;
    const max = vals.length ? Math.max(...vals) : null;
    return {
      source: "binance+coinbase+kraken",
      generatedAt: now,
      symbol: sym,
      exchanges: ex,
      spreadUsd: min != null && max != null ? num(max - min) : null,
      spreadPct: min ? num(((max! - min) / min) * 100, 3) : null,
      avg: vals.length ? num(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
    };
  },

  "global-crypto": async ({ now }) => {
    const { data } = await getJson("https://api.coingecko.com/api/v3/global");
    return {
      source: "coingecko/global",
      generatedAt: now,
      totalMarketCapUsd: Math.round(data.total_market_cap.usd),
      total24hVolumeUsd: Math.round(data.total_volume.usd),
      btcDominancePct: num(data.market_cap_percentage.btc),
      ethDominancePct: num(data.market_cap_percentage.eth),
      activeCryptocurrencies: data.active_cryptocurrencies,
      markets: data.markets,
      marketCapChange24hPct: num(data.market_cap_change_percentage_24h_usd),
    };
  },

  "coin-detail": async ({ url, now }) => {
    const id = (url.searchParams.get("coin") ?? "bitcoin").toLowerCase();
    const d = await getJson(
      `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
    );
    const m = d.market_data;
    return {
      source: "coingecko",
      generatedAt: now,
      id: d.id, symbol: (d.symbol ?? "").toUpperCase(), name: d.name,
      rank: d.market_cap_rank,
      priceUsd: m.current_price.usd,
      marketCapUsd: Math.round(m.market_cap.usd),
      volume24hUsd: Math.round(m.total_volume.usd),
      change24hPct: num(m.price_change_percentage_24h),
      change7dPct: num(m.price_change_percentage_7d),
      athUsd: m.ath.usd, athChangePct: num(m.ath_change_percentage.usd),
      circulatingSupply: m.circulating_supply, maxSupply: m.max_supply,
    };
  },

  "defi-tvl": async ({ now }) => {
    const list: any[] = await getJson("https://api.llama.fi/protocols");
    const top = list
      .filter((p) => typeof p.tvl === "number")
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 10)
      .map((p) => ({ name: p.name, category: p.category, chain: p.chain, tvlUsd: Math.round(p.tvl), change1dPct: num(p.change_1d) }));
    return { source: "defillama", generatedAt: now, topProtocols: top };
  },

  stablecoins: async ({ now }) => {
    const { peggedAssets } = await getJson("https://stablecoins.llama.fi/stablecoins?includePrices=true");
    const top = (peggedAssets ?? [])
      .map((a: any) => ({ name: a.name, symbol: a.symbol, peggedTo: a.pegType?.replace("pegged", ""), circulatingUsd: Math.round(a.circulating?.peggedUSD ?? 0), price: a.price ?? null }))
      .sort((a: any, b: any) => b.circulatingUsd - a.circulatingUsd)
      .slice(0, 8);
    return { source: "defillama/stablecoins", generatedAt: now, stablecoins: top };
  },

  sentiment: async ({ now }) => {
    const data = await getJson("https://api.alternative.me/fng/");
    const item = data.data?.[0];
    const score = Number(item?.value ?? 50);
    return {
      source: "alternative.me/fng", generatedAt: now,
      sentiment: item?.value_classification, score,
      signal: score < 25 ? "extreme_fear" : score < 45 ? "fear" : score < 55 ? "neutral" : score < 75 ? "greed" : "extreme_greed",
      interpretation: score < 25 ? "Extreme Fear — historically a buy signal for long-term holders." : score > 75 ? "Extreme Greed — market may be overheated, caution advised." : "Neutral — no strong directional bias.",
    };
  },

  dataset: async ({ now }) => {
    const data = await getJson("https://api.alternative.me/fng/?limit=7");
    return {
      source: "alternative.me/fng", generatedAt: now,
      current: data.data?.[0],
      history7d: (data.data ?? []).map((d: Record<string, string>) => ({
        date: new Date(Number(d.timestamp) * 1000).toISOString().split("T")[0],
        value: Number(d.value), label: d.value_classification,
      })),
    };
  },

  trending: async ({ now }) => {
    const data = await getJson("https://api.coingecko.com/api/v3/search/trending");
    const coins = (data.coins ?? []).slice(0, 7).map((c: { item: any }) => ({
      rank: c.item.market_cap_rank, name: c.item.name, symbol: c.item.symbol,
      priceUsd: c.item.data?.price, change24h: num(c.item.data?.price_change_percentage_24h?.usd),
    }));
    return { source: "coingecko/trending", generatedAt: now, coins };
  },

  mempool: async ({ now }) => {
    const [fees, height] = await Promise.all([
      getJson("https://mempool.space/api/v1/fees/recommended"),
      fetch("https://mempool.space/api/blocks/tip/height", { signal: AbortSignal.timeout(TIMEOUT) }).then((r) => r.text()).then(Number),
    ]);
    return {
      source: "mempool.space", generatedAt: now, blockHeight: height,
      fees: { fastestSat: fees.fastestFee, halfHourSat: fees.halfHourFee, hourSat: fees.hourFee, economySat: fees.economyFee, minimumSat: fees.minimumFee },
      interpretation: `Fastest: ${fees.fastestFee} sat/vB · Economy: ${fees.economyFee} sat/vB`,
    };
  },

  // ═══ STOCKS / COMMODITIES / FX ══════════════════════════════════════════════
  stocks: async ({ url, now }) => {
    const symbol = (url.searchParams.get("symbol") ?? "AAPL").toUpperCase();
    const d = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    const meta = d.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error("no quote");
    return {
      source: "yahoo-finance", generatedAt: now, symbol,
      name: meta.longName ?? meta.shortName ?? symbol,
      priceUsd: meta.regularMarketPrice, currency: meta.currency,
      previousClose: meta.chartPreviousClose, change: num(meta.regularMarketPrice - meta.chartPreviousClose),
      changePct: num(((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100),
      dayHigh: meta.regularMarketDayHigh, dayLow: meta.regularMarketDayLow, exchange: meta.exchangeName,
    };
  },

  metals: async ({ now }) => {
    // Gold & silver spot (USD/oz) from gold-api.com (free, no key).
    const [gold, silver] = await Promise.all([
      getJson("https://api.gold-api.com/price/XAU"),
      getJson("https://api.gold-api.com/price/XAG"),
    ]);
    return {
      source: "gold-api.com", generatedAt: now, unit: "USD/troy-ounce",
      gold: { symbol: "XAU", priceUsd: num(gold.price), updatedAt: gold.updatedAt },
      silver: { symbol: "XAG", priceUsd: num(silver.price), updatedAt: silver.updatedAt },
      goldSilverRatio: gold.price && silver.price ? num(gold.price / silver.price) : null,
    };
  },

  "fx-rates": async ({ now }) => {
    const d = await getJson("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,VND,SGD,CNY,AUD,KRW");
    return { source: "frankfurter/ECB", generatedAt: now, base: "USD", date: d.date, rates: d.rates };
  },

  "fx-convert": async ({ url, now }) => {
    const from = (url.searchParams.get("from") ?? "USD").toUpperCase();
    const to = (url.searchParams.get("to") ?? "VND").toUpperCase();
    const amount = Number(url.searchParams.get("amount") ?? "100") || 100;
    const d = await getJson(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`);
    return { source: "frankfurter/ECB", generatedAt: now, date: d.date, from, to, amount, result: d.rates?.[to] ?? null, rate: d.rates?.[to] ? num(d.rates[to] / amount, 6) : null };
  },

  // ═══ WEATHER / GEO / WORLD ══════════════════════════════════════════════════
  weather: async ({ url, now }) => {
    const loc = cityFrom(url);
    const d = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`);
    const c = d.current ?? {};
    return { source: "open-meteo", generatedAt: now, city: loc.name, temperatureC: c.temperature_2m, humidityPct: c.relative_humidity_2m, windSpeedKmh: c.wind_speed_10m, observedAt: c.time };
  },

  forecast: async ({ url, now }) => {
    const loc = cityFrom(url);
    const d = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`);
    const dd = d.daily ?? {};
    const days = (dd.time ?? []).map((t: string, i: number) => ({ date: t, highC: dd.temperature_2m_max?.[i], lowC: dd.temperature_2m_min?.[i], precipitationMm: dd.precipitation_sum?.[i] }));
    return { source: "open-meteo", generatedAt: now, city: loc.name, forecast7d: days };
  },

  "air-quality": async ({ url, now }) => {
    const loc = cityFrom(url);
    const d = await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,ozone`);
    const c = d.current ?? {};
    const aqi = c.us_aqi;
    return {
      source: "open-meteo/air-quality", generatedAt: now, city: loc.name, usAqi: aqi,
      level: aqi == null ? null : aqi <= 50 ? "Good" : aqi <= 100 ? "Moderate" : aqi <= 150 ? "Unhealthy for sensitive groups" : aqi <= 200 ? "Unhealthy" : "Very unhealthy",
      pm2_5: c.pm2_5, pm10: c.pm10, ozone: c.ozone, carbonMonoxide: c.carbon_monoxide, observedAt: c.time,
    };
  },

  "ip-info": async ({ req, url, now }) => {
    const ip = url.searchParams.get("ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const d = await getJson(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,zip,lat,lon,timezone,isp,org,query`);
    if (d.status !== "success") throw new Error("lookup failed");
    return { source: "ip-api.com", generatedAt: now, ip: d.query, country: d.country, countryCode: d.countryCode, region: d.region, city: d.city, lat: d.lat, lon: d.lon, timezone: d.timezone, isp: d.isp, org: d.org };
  },

  "country-info": async ({ url, now }) => {
    const country = url.searchParams.get("country") ?? "Vietnam";
    const data = await getJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=name,capital,population,region,subregion,currencies,languages,flags,area,timezones`);
    const c = data[0];
    return { source: "restcountries.com", generatedAt: now, name: c.name?.common, officialName: c.name?.official, capital: c.capital?.[0], population: c.population, region: c.region, subregion: c.subregion, area: c.area, currencies: c.currencies, languages: c.languages, timezones: c.timezones, flag: c.flags?.emoji };
  },

  holidays: async ({ url, now }) => {
    const country = (url.searchParams.get("country") ?? "US").toUpperCase().slice(0, 2);
    const year = new Date().getFullYear();
    const data: any[] = await getJson(`https://date.nager.at/api/v3/publicholidays/${year}/${country}`);
    return { source: "date.nager.at", generatedAt: now, country, year, count: data.length, holidays: data.slice(0, 15).map((h) => ({ date: h.date, name: h.localName, nameEn: h.name, global: h.global })) };
  },

  timezone: async ({ url, now }) => {
    const tz = url.searchParams.get("tz") ?? "Asia/Ho_Chi_Minh";
    const d = await getJson(`https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(tz)}`);
    return { source: "timeapi.io", generatedAt: now, timezone: tz, dateTime: d.dateTime, date: d.date, time: d.time, dayOfWeek: d.dayOfWeek };
  },

  geocode: async ({ url, now }) => {
    const name = url.searchParams.get("place") ?? "Hanoi";
    const d = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=3&language=en`);
    const results = (d.results ?? []).map((r: any) => ({ name: r.name, country: r.country, lat: r.latitude, lon: r.longitude, population: r.population, timezone: r.timezone }));
    return { source: "open-meteo/geocoding", generatedAt: now, query: name, results };
  },

  // ═══ KNOWLEDGE / DEV / AI ═══════════════════════════════════════════════════
  summarize: async ({ req, now }) => {
    let text = "";
    try { text = String((await req.json())?.text ?? ""); } catch { /* no body */ }
    if (!text) return { generatedAt: now, error: "Provide { text: '...' } in the request body." };
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
      const data = await getJson("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: "user", content: `Summarize in 3 concise bullet points:\n\n${text.slice(0, 3000)}` }] }),
      });
      return { source: "groq", model, generatedAt: now, summary: data.choices?.[0]?.message?.content ?? "", inputLength: text.length };
    }
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    return { source: "extractive", generatedAt: now, summary: sentences.slice(0, 3).join(" "), inputLength: text.length };
  },

  wikipedia: async ({ url, now }) => {
    const title = url.searchParams.get("title") ?? "Stablecoin";
    const d = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    return { source: "wikipedia", generatedAt: now, title: d.title, description: d.description, extract: d.extract, url: d.content_urls?.desktop?.page };
  },

  dictionary: async ({ url, now }) => {
    const word = url.searchParams.get("word") ?? "blockchain";
    const data = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const entry = data[0];
    return { source: "dictionaryapi.dev", generatedAt: now, word: entry.word, phonetic: entry.phonetic, meanings: (entry.meanings ?? []).slice(0, 3).map((m: any) => ({ partOfSpeech: m.partOfSpeech, definition: m.definitions?.[0]?.definition, example: m.definitions?.[0]?.example })) };
  },

  "news-tech": async ({ now }) => {
    const ids: number[] = await getJson("https://hacker-news.firebaseio.com/v0/topstories.json");
    const items = await Promise.all(ids.slice(0, 10).map((id) => getJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));
    return { source: "hacker-news", generatedAt: now, stories: items.map((s: any) => ({ title: s.title, url: s.url, score: s.score, by: s.by, comments: s.descendants })) };
  },

  "npm-stats": async ({ url, now }) => {
    const pkg = url.searchParams.get("package") ?? "react";
    const d = await getJson(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`);
    return { source: "npmjs.org", generatedAt: now, package: d.package, downloadsLastWeek: d.downloads, from: d.start, to: d.end };
  },

  "github-repo": async ({ url, now }) => {
    const repo = url.searchParams.get("repo") ?? "circlefin/x402";
    const d = await getJson(`https://api.github.com/repos/${repo}`, { headers: { Accept: "application/vnd.github+json" } });
    return { source: "github", generatedAt: now, fullName: d.full_name, description: d.description, stars: d.stargazers_count, forks: d.forks_count, openIssues: d.open_issues_count, language: d.language, url: d.html_url, updatedAt: d.updated_at };
  },

  quote: async ({ now }) => {
    const d = await getJson("https://zenquotes.io/api/random");
    const q = d[0];
    return { source: "zenquotes.io", generatedAt: now, quote: q.q, author: q.a };
  },

  joke: async ({ now }) => {
    const d = await getJson("https://v2.jokeapi.dev/joke/Programming,Misc?type=single&safe-mode");
    if (d.error) throw new Error("joke api error");
    return { source: "jokeapi.dev", generatedAt: now, category: d.category, joke: d.joke };
  },
};

/** Produce live data for a service, falling back to its sample on any failure. */
export async function produceServiceData(slug: string, req: NextRequest, fallback: unknown): Promise<unknown> {
  const now = new Date().toISOString();
  const provider = providers[slug];
  if (!provider) return { generatedAt: now, data: fallback };
  try {
    return await provider({ req, url: new URL(req.url), now, fallback });
  } catch {
    return { source: "sample", note: "Live source unavailable — returning sample.", generatedAt: now, ...((fallback as object) ?? {}) };
  }
}
