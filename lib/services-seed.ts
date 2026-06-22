import type { Service } from "./types";

// All demo sellers settle to this address (a registered Circle Gateway account).
const SELLER = "0x89100844705F50e9566386B908059B27041804D0";

// Helper to keep the seed terse and consistent.
function svc(s: Omit<Service, "sellerAddress" | "endpoint" | "active"> & { endpoint?: string }): Service {
  return {
    sellerAddress: SELLER,
    endpoint: s.endpoint ?? `/api/premium/${s.slug}`,
    active: true,
    ...s,
  };
}

export const SEED_SERVICES: Service[] = [
  // ═══ CRYPTO ═══════════════════════════════════════════════════════════════
  svc({
    slug: "oracle-check", name: "Crypto Price Oracle", category: "oracle",
    sellerName: "OracleWorks", price: "0.005", method: "GET",
    description: "Spot prices, 24h change and market cap for any coins via CoinGecko. Add ?coins=bitcoin,ethereum,dogecoin (CoinGecko ids). Defaults to BTC/ETH/SOL.",
    tags: ["price", "spot", "coingecko", "settlement"], verified: true,
    inputSchema: {
      type: "object",
      properties: {
        coins: { type: "string", description: "Comma-separated CoinGecko ids", example: "bitcoin,ethereum" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        prices: { type: "object", description: "Map of coin id → { usd, change24h }" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["prices"],
    },
    sampleResponse: { source: "coingecko", prices: { bitcoin: { usd: 67420, change24h: 2.3 } }, confidence: 0.99 },
    createdAt: "2026-06-03T00:00:00.000Z",
  }),
  svc({
    slug: "price-multi-exchange", name: "Multi-Exchange Price & Spread", category: "oracle",
    sellerName: "OracleWorks", price: "0.006", method: "GET",
    description: "Same asset priced live across Binance, Coinbase and Kraken, with the cross-exchange spread — so agents can spot arbitrage. Add ?symbol=ETH.",
    tags: ["arbitrage", "binance", "coinbase", "kraken", "spread"], verified: true,
    sampleResponse: { symbol: "BTC", exchanges: { binance: 67410, coinbase: 67455, kraken: 67430 }, spreadUsd: 45, spreadPct: 0.067 },
    createdAt: "2026-06-03T06:00:00.000Z",
  }),
  svc({
    slug: "global-crypto", name: "Global Crypto Market Stats", category: "market-insight",
    sellerName: "OracleWorks", price: "0.004", method: "GET",
    description: "Total crypto market cap, 24h volume, BTC/ETH dominance and number of active coins. The macro snapshot agents need before any trade.",
    tags: ["marketcap", "dominance", "volume", "macro"], verified: true,
    sampleResponse: { totalMarketCapUsd: 2.4e12, btcDominancePct: 54.2, ethDominancePct: 17.1, activeCryptocurrencies: 13800 },
    createdAt: "2026-06-03T12:00:00.000Z",
  }),
  svc({
    slug: "coin-detail", name: "Coin Deep-Dive", category: "market-insight",
    sellerName: "OracleWorks", price: "0.005", method: "GET",
    description: "Full profile for one coin: price, market cap, volume, 24h/7d change, all-time-high and supply. Add ?coin=ethereum (CoinGecko id).",
    tags: ["coin", "ath", "supply", "fundamentals"], verified: true,
    sampleResponse: { name: "Ethereum", symbol: "ETH", rank: 2, priceUsd: 3512, athUsd: 4878, change7dPct: -1.4 },
    createdAt: "2026-06-04T00:00:00.000Z",
  }),
  svc({
    slug: "defi-tvl", name: "DeFi TVL Leaderboard", category: "data",
    sellerName: "ChainLabs", price: "0.004", method: "GET",
    description: "Top 10 DeFi protocols by total value locked (TVL) with 1-day change, sourced from DefiLlama. For agents tracking where capital sits on-chain.",
    tags: ["defi", "tvl", "defillama", "protocols"], verified: true,
    sampleResponse: { topProtocols: [{ name: "Lido", category: "Liquid Staking", tvlUsd: 32000000000, change1dPct: 0.8 }] },
    createdAt: "2026-06-04T06:00:00.000Z",
  }),
  svc({
    slug: "stablecoins", name: "Stablecoin Market Caps", category: "data",
    sellerName: "ChainLabs", price: "0.003", method: "GET",
    description: "Circulating supply and peg of the top 8 stablecoins (USDC, USDT, DAI…) from DefiLlama. Track the money supply of the on-chain economy.",
    tags: ["stablecoin", "usdc", "peg", "supply"], verified: true,
    sampleResponse: { stablecoins: [{ name: "USD Coin", symbol: "USDC", circulatingUsd: 34000000000, price: 1.0 }] },
    createdAt: "2026-06-04T12:00:00.000Z",
  }),
  svc({
    slug: "sentiment", name: "Crypto Market Sentiment", category: "ai",
    sellerName: "ChainLabs", price: "0.002", method: "GET",
    description: "Real-time Crypto Fear & Greed Index with an actionable signal. One call returns current score, label and interpretation.",
    tags: ["sentiment", "fear-greed", "signal", "market"], verified: true,
    sampleResponse: { sentiment: "Greed", score: 67, signal: "greed" },
    createdAt: "2026-06-05T00:00:00.000Z",
  }),
  svc({
    slug: "dataset", name: "Fear & Greed 7-Day Dataset", category: "data",
    sellerName: "ChainLabs", price: "0.001", method: "GET",
    description: "7-day history of the Crypto Fear & Greed Index. Useful for agents timing entries, managing risk or training sentiment models.",
    tags: ["analytics", "sentiment", "fear-greed", "history"], verified: true,
    sampleResponse: { current: { value: "62" }, history7d: [{ date: "2026-06-18", value: 62, label: "Greed" }] },
    createdAt: "2026-06-05T06:00:00.000Z",
  }),
  svc({
    slug: "trending", name: "Trending Coins Right Now", category: "market-insight",
    sellerName: "TrendBot", price: "0.003", method: "GET",
    description: "Top trending coins on CoinGecko in the last 24h — name, symbol, rank and 24h change. Perfect for agents scanning momentum.",
    tags: ["trending", "coins", "momentum", "coingecko"], verified: false,
    sampleResponse: { coins: [{ rank: 1, name: "Bitcoin", symbol: "BTC" }] },
    createdAt: "2026-06-06T00:00:00.000Z",
  }),
  svc({
    slug: "mempool", name: "Bitcoin Mempool & Fees", category: "oracle",
    sellerName: "MempoolWatch", price: "0.003", method: "GET",
    description: "Live Bitcoin fee rates (sat/vB) for fastest, half-hour, hour and economy confirmation, plus current block height. Essential before sending BTC.",
    tags: ["bitcoin", "fees", "mempool", "btc"], verified: true,
    sampleResponse: { fees: { fastestSat: 22, economySat: 4 }, blockHeight: 900123 },
    createdAt: "2026-06-06T06:00:00.000Z",
  }),

  // ═══ STOCKS / COMMODITIES / FX ══════════════════════════════════════════════
  svc({
    slug: "stocks", name: "Stock Quote (Equities)", category: "oracle",
    sellerName: "WallStreetFeed", price: "0.006", method: "GET",
    description: "Real-time stock quote: price, day high/low, previous close and % change. Add ?symbol=AAPL (TSLA, MSFT, NVDA, AMZN…). Sourced from Yahoo Finance.",
    tags: ["stocks", "equities", "nasdaq", "tradfi"], verified: true,
    sampleResponse: { symbol: "AAPL", name: "Apple Inc.", priceUsd: 228.5, changePct: 1.2, currency: "USD" },
    createdAt: "2026-06-07T00:00:00.000Z",
  }),
  svc({
    slug: "metals", name: "Gold & Silver Spot", category: "oracle",
    sellerName: "WallStreetFeed", price: "0.005", method: "GET",
    description: "Live gold (XAU) and silver (XAG) spot prices in USD per troy ounce, plus the gold/silver ratio. For agents pricing commodities or hedges.",
    tags: ["gold", "silver", "commodities", "xau"], verified: true,
    sampleResponse: { gold: { priceUsd: 2345.6 }, silver: { priceUsd: 29.4 }, goldSilverRatio: 79.8 },
    createdAt: "2026-06-07T06:00:00.000Z",
  }),
  svc({
    slug: "fx-rates", name: "USD Foreign Exchange Rates", category: "data",
    sellerName: "FXFeed", price: "0.002", method: "GET",
    description: "Latest USD exchange rates (EUR, GBP, JPY, VND, SGD, CNY, AUD, KRW) from European Central Bank data. For multi-currency pricing.",
    tags: ["forex", "currency", "usd", "rates"], verified: true,
    sampleResponse: { base: "USD", rates: { EUR: 0.92, VND: 25400, JPY: 157 } },
    createdAt: "2026-06-08T00:00:00.000Z",
  }),
  svc({
    slug: "fx-convert", name: "Currency Converter", category: "data",
    sellerName: "FXFeed", price: "0.002", method: "GET",
    description: "Convert an amount between any two currencies at the latest ECB rate. Add ?from=USD&to=VND&amount=100. Returns the converted result and unit rate.",
    tags: ["forex", "convert", "currency", "fx"], verified: true,
    sampleResponse: { from: "USD", to: "VND", amount: 100, result: 2540000, rate: 25400 },
    createdAt: "2026-06-08T06:00:00.000Z",
  }),

  // ═══ WEATHER / GEO / WORLD ══════════════════════════════════════════════════
  svc({
    slug: "weather", name: "Global Weather Now", category: "data",
    sellerName: "WeatherWorks", price: "0.001", method: "GET",
    description: "Live temperature, humidity and wind for major cities. Add ?city=tokyo (hanoi, saigon, singapore, tokyo, london, newyork, dubai).",
    tags: ["weather", "temperature", "cities", "realtime"], verified: true,
    sampleResponse: { city: "Hanoi", temperatureC: 31, humidityPct: 70, windSpeedKmh: 8 },
    createdAt: "2026-06-09T00:00:00.000Z",
  }),
  svc({
    slug: "forecast", name: "7-Day Weather Forecast", category: "data",
    sellerName: "WeatherWorks", price: "0.002", method: "GET",
    description: "7-day daily forecast (high, low, precipitation) for any supported city. Add ?city=singapore. For agents planning logistics or travel.",
    tags: ["weather", "forecast", "7-day", "planning"], verified: true,
    sampleResponse: { city: "Hanoi", forecast7d: [{ date: "2026-06-22", highC: 34, lowC: 27, precipitationMm: 2.1 }] },
    createdAt: "2026-06-09T06:00:00.000Z",
  }),
  svc({
    slug: "air-quality", name: "Air Quality Index", category: "data",
    sellerName: "WeatherWorks", price: "0.002", method: "GET",
    description: "Real-time US AQI plus PM2.5, PM10 and ozone for any supported city, with a health level label. Add ?city=newyork.",
    tags: ["air-quality", "aqi", "pollution", "health"], verified: true,
    sampleResponse: { city: "Hanoi", usAqi: 142, level: "Unhealthy for sensitive groups", pm2_5: 53 },
    createdAt: "2026-06-09T12:00:00.000Z",
  }),
  svc({
    slug: "ip-info", name: "IP Geolocation Lookup", category: "data",
    sellerName: "GeoNet", price: "0.002", method: "GET",
    description: "Resolve any IP to country, city, ISP and coordinates. Add ?ip=8.8.8.8, or omit to auto-detect the caller.",
    tags: ["geolocation", "ip", "country", "isp"], verified: true,
    sampleResponse: { ip: "8.8.8.8", country: "United States", city: "Mountain View", isp: "Google LLC" },
    createdAt: "2026-06-10T00:00:00.000Z",
  }),
  svc({
    slug: "country-info", name: "Country Facts & Stats", category: "data",
    sellerName: "GeoNet", price: "0.002", method: "GET",
    description: "Population, capital, region, languages, currencies and area for any country. Add ?country=Vietnam. For geo-targeted research.",
    tags: ["country", "population", "geography", "stats"], verified: true,
    sampleResponse: { name: "Vietnam", capital: "Hanoi", population: 97338579, region: "Asia" },
    createdAt: "2026-06-10T06:00:00.000Z",
  }),
  svc({
    slug: "geocode", name: "Place → Coordinates", category: "data",
    sellerName: "GeoNet", price: "0.001", method: "GET",
    description: "Turn a place name into latitude/longitude, country, population and timezone. Add ?place=Da Nang. The lookup agents call before any map task.",
    tags: ["geocode", "coordinates", "places", "maps"], verified: true,
    sampleResponse: { query: "Hanoi", results: [{ name: "Hanoi", country: "Vietnam", lat: 21.03, lon: 105.85 }] },
    createdAt: "2026-06-10T12:00:00.000Z",
  }),
  svc({
    slug: "timezone", name: "World Time & Timezone", category: "data",
    sellerName: "GeoNet", price: "0.001", method: "GET",
    description: "Current date, time and day-of-week for any IANA timezone. Add ?tz=America/New_York. For agents scheduling across regions.",
    tags: ["time", "timezone", "clock", "schedule"], verified: true,
    sampleResponse: { timezone: "Asia/Ho_Chi_Minh", dateTime: "2026-06-22T14:05:00", dayOfWeek: "Monday" },
    createdAt: "2026-06-11T00:00:00.000Z",
  }),
  svc({
    slug: "holidays", name: "Public Holidays by Country", category: "data",
    sellerName: "CalendarAPI", price: "0.001", method: "GET",
    description: "Public holidays for any country this year. Add ?country=VN (ISO 2-letter). Supports 100+ countries. Useful for scheduling agents.",
    tags: ["calendar", "holidays", "country", "schedule"], verified: true,
    sampleResponse: { country: "VN", year: 2026, holidays: [{ date: "2026-01-01", name: "New Year's Day" }] },
    createdAt: "2026-06-11T06:00:00.000Z",
  }),

  // ═══ KNOWLEDGE / DEV / AI ═══════════════════════════════════════════════════
  svc({
    slug: "summarize", name: "AI Document Summarizer", category: "ai",
    sellerName: "BriefBot", price: "0.02", method: "POST",
    description: "POST { text } and get a 3-bullet structured summary. Uses a Llama-3.3 LLM when available, with an extractive fallback. Pay-per-call, no API key.",
    tags: ["llm", "summary", "nlp", "ai"], verified: true,
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to summarize", minLength: 1 },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "3-bullet structured summary" },
        inputLength: { type: "number" },
      },
      required: ["summary"],
    },
    sampleResponse: { summary: "• point one\n• point two\n• point three", inputLength: 512 },
    createdAt: "2026-06-12T00:00:00.000Z",
  }),
  svc({
    slug: "wikipedia", name: "Wikipedia Summary", category: "data",
    sellerName: "KnowledgeAPI", price: "0.002", method: "GET",
    description: "Plain-language summary of any Wikipedia article. Add ?title=Stablecoin. For agents that need quick, sourced background knowledge.",
    tags: ["wikipedia", "knowledge", "research", "encyclopedia"], verified: true,
    sampleResponse: { title: "Stablecoin", extract: "A stablecoin is a type of cryptocurrency…" },
    createdAt: "2026-06-12T06:00:00.000Z",
  }),
  svc({
    slug: "dictionary", name: "English Dictionary", category: "data",
    sellerName: "KnowledgeAPI", price: "0.001", method: "GET",
    description: "Definitions, part of speech, phonetics and examples for any English word. Add ?word=blockchain. For language and content agents.",
    tags: ["dictionary", "definition", "english", "nlp"], verified: true,
    sampleResponse: { word: "blockchain", meanings: [{ partOfSpeech: "noun", definition: "A digital ledger…" }] },
    createdAt: "2026-06-12T12:00:00.000Z",
  }),
  svc({
    slug: "news-tech", name: "Top Tech News", category: "data",
    sellerName: "DevFeed", price: "0.003", method: "GET",
    description: "Top 10 stories on Hacker News right now — title, link, score and comment count. For agents tracking the tech zeitgeist.",
    tags: ["news", "hacker-news", "tech", "headlines"], verified: true,
    sampleResponse: { stories: [{ title: "Show HN: …", score: 412, by: "pg", comments: 88 }] },
    createdAt: "2026-06-13T00:00:00.000Z",
  }),
  svc({
    slug: "npm-stats", name: "NPM Package Downloads", category: "data",
    sellerName: "DevFeed", price: "0.002", method: "GET",
    description: "Weekly download count for any npm package. Add ?package=next. For agents evaluating dependency popularity or supply-chain risk.",
    tags: ["npm", "downloads", "packages", "dev"], verified: true,
    sampleResponse: { package: "react", downloadsLastWeek: 24500000 },
    createdAt: "2026-06-13T06:00:00.000Z",
  }),
  svc({
    slug: "github-repo", name: "GitHub Repo Stats", category: "data",
    sellerName: "DevFeed", price: "0.002", method: "GET",
    description: "Stars, forks, open issues, language and description for any public GitHub repo. Add ?repo=circlefin/x402. For dev-research agents.",
    tags: ["github", "stars", "repo", "oss"], verified: true,
    sampleResponse: { fullName: "circlefin/x402", stars: 1240, forks: 88, language: "TypeScript" },
    createdAt: "2026-06-13T12:00:00.000Z",
  }),
  svc({
    slug: "quote", name: "Inspirational Quote", category: "ai",
    sellerName: "JokeBot", price: "0.001", method: "GET",
    description: "A random inspirational quote with author. A cheap, fun way to add personality to agent output — and to test the x402 flow.",
    tags: ["quote", "inspiration", "fun", "demo"], verified: false,
    sampleResponse: { quote: "The best way to predict the future is to invent it.", author: "Alan Kay" },
    createdAt: "2026-06-14T00:00:00.000Z",
  }),
  svc({
    slug: "joke", name: "Random Dev Joke", category: "ai",
    sellerName: "JokeBot", price: "0.001", method: "GET",
    description: "A safe, random programming joke. Adds personality to agents — and the cheapest way to test the x402 payment flow at $0.001 per call.",
    tags: ["fun", "joke", "programming", "demo"], verified: false,
    sampleResponse: { category: "Programming", joke: "Why do programmers prefer dark mode? Because light attracts bugs." },
    createdAt: "2026-06-14T06:00:00.000Z",
  }),
];
