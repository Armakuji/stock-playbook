// Mirrors web/app/api/prices/route.ts — same free, no-key Yahoo Finance
// chart endpoint. Returns only the price (the validation prompt doesn't
// need change% or market state).

interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
}

export async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      chart?: { result?: { meta?: YahooMeta }[] };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}
