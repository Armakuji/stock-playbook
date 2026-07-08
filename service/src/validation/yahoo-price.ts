// Mirrors web/app/api/prices/route.ts — same free, no-key Yahoo Finance
// chart endpoint. Returns only the price (the validation prompt doesn't
// need change% or market state).
//
// Yahoo Finance rate-limits/blocks requests from cloud-hosting IP ranges
// (Railway, Render, AWS, etc.) far more aggressively than residential IPs —
// this is why price fetches can fail 100% of the time in production while
// working fine on a developer's machine. To work around it, we prefer
// routing through the already-deployed Next.js app on Vercel (WEB_ORIGIN),
// whose /api/prices route hits the same Yahoo endpoint from Vercel's egress,
// which isn't blocked. Direct Yahoo calls remain the fallback for local dev
// (no WEB_ORIGIN needed) and in case the proxy hop itself fails.

interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
}

async function fetchFromYahooDirect(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(
        `[yahoo-price] direct fetch for ${ticker} failed: HTTP ${res.status} ${res.statusText}`,
      );
      return null;
    }

    const data = (await res.json()) as {
      chart?: { result?: { meta?: YahooMeta }[] };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) {
      console.warn(
        `[yahoo-price] direct fetch for ${ticker}: no meta in response`,
      );
      return null;
    }

    const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
    return typeof price === "number" ? price : null;
  } catch (err) {
    console.warn(
      `[yahoo-price] direct fetch for ${ticker} threw: ${String(err)}`,
    );
    return null;
  }
}

async function fetchViaWebProxy(
  tickers: string[],
): Promise<Record<string, number>> {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) return {};

  try {
    const url = `${webOrigin}/api/prices?tickers=${encodeURIComponent(tickers.join(","))}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(
        `[yahoo-price] web proxy fetch failed: HTTP ${res.status} ${res.statusText}`,
      );
      return {};
    }
    const data = (await res.json()) as Record<
      string,
      { price?: number } | null
    >;
    const prices: Record<string, number> = {};
    for (const ticker of tickers) {
      const price = data[ticker]?.price;
      if (typeof price === "number") prices[ticker] = price;
    }
    return prices;
  } catch (err) {
    console.warn(`[yahoo-price] web proxy fetch threw: ${String(err)}`);
    return {};
  }
}

/**
 * Fetches current prices for multiple tickers in one batch. Prefers the
 * Vercel-hosted /api/prices proxy (WEB_ORIGIN) since that egress isn't
 * rate-limited by Yahoo the way Railway's is; falls back to direct
 * per-ticker Yahoo calls for any ticker the proxy didn't return.
 */
export async function fetchCurrentPrices(
  tickers: string[],
): Promise<Record<string, number | null>> {
  const uniqueTickers = [...new Set(tickers)];
  const proxyPrices = await fetchViaWebProxy(uniqueTickers);

  const missing = uniqueTickers.filter((t) => proxyPrices[t] === undefined);
  const directResults = await Promise.all(
    missing.map(async (t) => [t, await fetchFromYahooDirect(t)] as const),
  );

  const result: Record<string, number | null> = { ...proxyPrices };
  for (const [ticker, price] of directResults) {
    result[ticker] = price;
  }
  return result;
}

export async function fetchCurrentPrice(
  ticker: string,
): Promise<number | null> {
  const prices = await fetchCurrentPrices([ticker]);
  return prices[ticker] ?? null;
}
