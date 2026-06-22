// ─── Live Price API — fetches from Yahoo Finance ─────────────────────────────
// GET /api/prices?tickers=NVDA,AVGO,ASTS
// Returns: { NVDA: { price: 131.38, change: 2.4, source: "yahoo", fetchedAt: "..." }, ... }
// Delayed ~15 min (Yahoo Finance free, no API key required)

import { NextRequest, NextResponse } from "next/server";

interface YahooQuote {
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
  marketState?: string;
}

export interface LivePrice {
  price: number;
  change: number;
  changePct: number;
  source: "yahoo";
  marketState: string;   // "REGULAR" | "PRE" | "POST" | "CLOSED"
  fetchedAt: string;     // ISO string
}

async function fetchYahooPrice(ticker: string): Promise<LivePrice | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      next: { revalidate: 60 }, // cache 60s
    });

    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
    if (!price) return null;

    const prevClose = meta.chartPreviousClose ?? price;
    const change    = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      price,
      change,
      changePct,
      source: "yahoo",
      marketState: meta.marketState ?? "UNKNOWN",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20); // max 20 tickers per call

  if (tickers.length === 0) {
    return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
  }

  // Fetch all in parallel
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const quote = await fetchYahooPrice(ticker);
      return [ticker, quote] as [string, LivePrice | null];
    })
  );

  const priceMap = Object.fromEntries(results.filter(([, v]) => v !== null));

  return NextResponse.json(priceMap, {
    headers: {
      "Cache-Control": "no-store", // don't CDN-cache — let Next.js revalidate handle it
    },
  });
}
