// ─── Trade Journal Page — LOCAL ONLY ─────────────────────────────────────────
// This page is intentionally NOT linked from the public nav.
// Access at http://localhost:3000/journal on the Mac Mini.
// Vercel static export skips API routes, so writes will silently no-op there.

import { readJournal } from "@/lib/journal";
import { computeStats } from "@/lib/journal-math";
import { getAllReports } from "@/lib/reports";
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

  return <JournalContent initialTrades={journal.trades} stats={stats} reportOptions={reportOptions} />;
}
