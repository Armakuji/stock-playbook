// ─── Trade Journal Page ───────────────────────────────────────────────────────
// Trades now live in the Journal API (Postgres via Railway) — this page fetches
// them server-side, forwarding the session cookie. See docs/architecture/journal-api.md.

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { Trade } from "@/lib/journal-types";
import { computeStats } from "@/lib/journal-math";
import { getAllReports, getAllReportsGrouped } from "@/lib/reports";
import { JournalContent } from "./JournalContent";
import { LoginGate } from "./LoginGate";

const API_ORIGIN = process.env.JOURNAL_API_ORIGIN ?? "http://localhost:4000";

export default async function JournalPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return <LoginGate />;
  }

  const headers = { Cookie: `session=${sessionCookie}` };
  const tradesRes = await fetch(`${API_ORIGIN}/trades`, { headers, cache: "no-store" });

  if (!tradesRes.ok) {
    return <LoginGate />;
  }

  const trades: Trade[] = await tradesRes.json();
  const stats = computeStats(trades);
  const reports = getAllReports();

  const reportOptions = reports.map((r) => ({
    ticker: r.ticker,
    companyName: r.companyName,
    price: r.price,
    tp1: r.entryStrategy.tp1.price,
    tp2: r.entryStrategy.tp2.price,
    tp3: r.entryStrategy.tp3.price,
    tightStop: r.entryStrategy.stopLoss.tight ?? null,
    reportDate: r.generatedAt.slice(0, 10).replace(/-/g, ""),
    catalystType: r.catalystSpot?.catalystType ?? null,
  }));

  const priceMap: Record<string, { price: number; generatedAt: string; companyName: string }> = {};
  for (const r of reports) {
    priceMap[r.ticker] = { price: r.price, generatedAt: r.generatedAt, companyName: r.companyName };
  }

  const grouped = getAllReportsGrouped();
  const reportsByTicker: Record<
    string,
    { reportDate: string; price: number; tp1: number; tp2: number; tp3: number; tightStop: number | null; catalystType: string | null }[]
  > = {};
  for (const [ticker, reps] of Object.entries(grouped)) {
    reportsByTicker[ticker] = reps.map((r) => ({
      reportDate: r.generatedAt.slice(0, 10).replace(/-/g, ""),
      price: r.price,
      tp1: r.entryStrategy.tp1.price,
      tp2: r.entryStrategy.tp2.price,
      tp3: r.entryStrategy.tp3.price,
      tightStop: r.entryStrategy.stopLoss.tight ?? null,
      catalystType: r.catalystSpot?.catalystType ?? null,
    }));
  }

  return (
    <JournalContent
      initialTrades={trades}
      stats={stats}
      reportOptions={reportOptions}
      priceMap={priceMap}
      reportsByTicker={reportsByTicker}
    />
  );
}
