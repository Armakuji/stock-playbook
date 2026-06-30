// ─── Trade Journal Page — LOCAL ONLY ─────────────────────────────────────────
// This page is intentionally NOT linked from the public nav.
// Access at http://localhost:3000/journal on the Mac Mini.
// Vercel static export skips API routes, so writes will silently no-op there.

// Must read private/journal.json on every request — never bake trades in at build time.
export const dynamic = "force-dynamic";

import { readJournal } from "@/lib/journal";
import { computeStats } from "@/lib/journal-math";
import { getAllReports, getAllReportsGrouped } from "@/lib/reports";
import { JournalContent } from "./JournalContent";

export default function JournalPage() {
  const journal = readJournal();
  const stats   = computeStats(journal.trades);
  const reports = getAllReports();

  // Slim down to only what the form needs — avoids shipping full report JSONs to client
  const reportOptions = reports.map((r) => ({
    ticker:          r.ticker,
    companyName:     r.companyName,
    price:           r.price,
    tp1:             r.entryStrategy.tp1.price,
    tp2:             r.entryStrategy.tp2.price,
    tp3:             r.entryStrategy.tp3.price,
    tightStop:       r.entryStrategy.stopLoss.tight ?? null,
    reportDate:      r.generatedAt.slice(0, 10).replace(/-/g, ""), // YYYYMMDD
    catalystType:    r.catalystSpot?.catalystType ?? null,
  }));

  // Live price map — keyed by ticker, sourced from latest report JSON
  const priceMap: Record<string, { price: number; generatedAt: string; companyName: string }> = {};
  for (const r of reports) {
    priceMap[r.ticker] = {
      price:       r.price,
      generatedAt: r.generatedAt,
      companyName: r.companyName,
    };
  }

  // All reports grouped by ticker — for report date select box in TradeForm
  const grouped = getAllReportsGrouped();
  const reportsByTicker: Record<string, { reportDate: string; price: number; tp1: number; tp2: number; tp3: number; tightStop: number | null; catalystType: string | null }[]> = {};
  for (const [ticker, reps] of Object.entries(grouped)) {
    reportsByTicker[ticker] = reps.map((r) => ({
      reportDate:   r.generatedAt.slice(0, 10).replace(/-/g, ""), // YYYYMMDD
      price:        r.price,
      tp1:          r.entryStrategy.tp1.price,
      tp2:          r.entryStrategy.tp2.price,
      tp3:          r.entryStrategy.tp3.price,
      tightStop:    r.entryStrategy.stopLoss.tight ?? null,
      catalystType: r.catalystSpot?.catalystType ?? null,
    }));
  }

  return <JournalContent initialTrades={journal.trades} stats={stats} reportOptions={reportOptions} priceMap={priceMap} reportsByTicker={reportsByTicker} />;
}
