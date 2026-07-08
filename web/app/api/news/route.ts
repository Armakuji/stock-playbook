// ─── Ticker News API — fetches recent headlines from Yahoo Finance search ────
// GET /api/news?tickers=NVDA,AVGO,ASTS&count=5
// Returns: { NVDA: [{ title, publisher, link, publishedAt }], ... }
// Same free, no-key Yahoo Finance endpoint pattern as /api/prices — the
// journal-api service (Railway) proxies through here for the same reason
// (Yahoo blocks/rate-limits Railway's egress far more than Vercel's).

import { NextRequest, NextResponse } from "next/server";

interface YahooNewsItem {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number; // unix seconds
}

export interface NewsHeadline {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string; // ISO string
}

const MAX_HEADLINES_PER_TICKER = 5;

async function fetchYahooNews(
  ticker: string,
  count: number,
): Promise<NewsHeadline[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=${count}&quotesCount=0`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      next: { revalidate: 300 }, // cache 5 min — headlines don't need per-request freshness
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { news?: YahooNewsItem[] };
    const items = data?.news ?? [];

    return items
      .filter((n): n is Required<Pick<YahooNewsItem, "title" | "publisher" | "link">> & YahooNewsItem =>
        typeof n.title === "string" && typeof n.publisher === "string" && typeof n.link === "string",
      )
      .slice(0, count)
      .map((n) => ({
        title: n.title!,
        publisher: n.publisher!,
        link: n.link!,
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toISOString()
          : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20); // max 20 tickers per call

  const count = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("count")) || 3, 1),
    MAX_HEADLINES_PER_TICKER,
  );

  if (tickers.length === 0) {
    return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
  }

  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const headlines = await fetchYahooNews(ticker, count);
      return [ticker, headlines] as [string, NewsHeadline[]];
    }),
  );

  const newsMap = Object.fromEntries(results);

  return NextResponse.json(newsMap, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
