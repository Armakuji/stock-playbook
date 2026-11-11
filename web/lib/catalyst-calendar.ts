import fs from "fs";
import path from "path";
import { StockReport } from "./types";
import { parseDateStr, proximityISO } from "./catalyst-timing";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export interface CalendarEvent {
  ticker: string;
  companyName: string;
  verdict: StockReport["verdict"];
  name: string;
  dateStr: string;        // original string, e.g. "Jul 2, 2026"
  isoDate: string;        // "YYYY-MM-DD" — used for sorting and countdown
  isEstimate: boolean;    // true = estimateDates source, false = catalysts source
  badgeColor?: string;    // from catalyst.badgeColor
}

// Date parsing now lives in ./catalyst-timing (parseDateStr) — single source,
// also client-safe. catalystISO() prefers an explicit catalystDate over dateBadge.

// ── Main export ───────────────────────────────────────────────────────────────

export function getCatalystCalendar(): CalendarEvent[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];

  // Load latest report per ticker
  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json")).sort().reverse();
  const seen = new Set<string>();
  const reports: StockReport[] = [];

  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), "utf-8")) as StockReport;
      if (!seen.has(r.ticker)) { seen.add(r.ticker); reports.push(r); }
    } catch { /* skip bad files */ }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().slice(0, 10);

  const events: CalendarEvent[] = [];

  for (const r of reports) {
    // From catalysts[]
    for (const c of r.catalysts ?? []) {
      // Fuzzy (~) catalysts have no real event day — keep them off the calendar.
      const iso = proximityISO(c);
      if (!iso || iso < todayISO) continue;
      events.push({
        ticker: r.ticker,
        companyName: r.companyName,
        verdict: r.verdict,
        name: c.name,
        dateStr: c.dateBadge ?? iso,
        isoDate: iso,
        isEstimate: false,
        badgeColor: c.badgeColor,
      });
    }

    // From estimateDates[]
    for (const e of r.estimateDates ?? []) {
      if (!e.dateRange) continue;
      const iso = parseDateStr(e.dateRange);
      if (!iso || iso < todayISO) continue;
      events.push({
        ticker: r.ticker,
        companyName: r.companyName,
        verdict: r.verdict,
        name: e.event,
        dateStr: e.dateRange,
        isoDate: iso,
        isEstimate: true,
        badgeColor: e.highlight ?? undefined,
      });
    }
  }

  // Sort ascending
  events.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return events;
}
