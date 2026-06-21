// ─── Backtest Price Fetcher — LOCAL ONLY ─────────────────────────────────────
// Fetches historical prices from Yahoo Finance and writes them to
// web/data/backtest-cache.json so subsequent builds are fast.
// This route does NOT exist on Vercel (static export has no API routes).

import { NextRequest, NextResponse } from "next/server";
import { readCache, writeCache, cacheKey } from "@/lib/backtest";

/** Fetch closing price for a ticker on a given YYYY-MM-DD date via Yahoo Finance */
async function fetchPrice(ticker: string, date: string): Promise<number | null> {
  // Yahoo Finance chart endpoint — unofficial but widely used
  const dt = new Date(date + "T12:00:00Z");
  const p1 = Math.floor(dt.getTime() / 1000) - 86400;
  const p2 = Math.floor(dt.getTime() / 1000) + 86400;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=1d&period1=${p1}&period2=${p2}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: number[] }> } }> };
    };
    const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes || closes.length === 0) return null;
    // Find the closest non-null close
    const valid = closes.filter((v): v is number => v !== null && v !== undefined);
    return valid.length > 0 ? valid[valid.length - 1] : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { ticker: string; date: string }[];

  const cache = readCache();
  const results: Record<string, number | null> = {};

  for (const { ticker, date } of body) {
    const key = cacheKey(ticker, date);
    if (cache[key]) {
      results[key] = cache[key].price;
      continue;
    }
    const price = await fetchPrice(ticker, date);
    if (price !== null) {
      cache[key] = { price, fetchedAt: new Date().toISOString() };
    }
    results[key] = price;
  }

  writeCache(cache);
  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  return NextResponse.json(readCache());
}
