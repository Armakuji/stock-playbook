import fs from "fs";
import path from "path";
import { StockReport } from "./types";

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

// ── Date parser ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse a loose date string into YYYY-MM-DD.
 * Returns null if unparseable or too vague.
 */
export function parseDateStr(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // "Jul 2, 2026" or "Jun 2026"
  const monthDayYear = s.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYear) {
    const m = MONTH_MAP[monthDayYear[1].toLowerCase()];
    if (m === undefined) return null;
    return toISO(parseInt(monthDayYear[3]), m, parseInt(monthDayYear[2]));
  }

  const monthYear = s.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (monthYear) {
    const m = MONTH_MAP[monthYear[1].toLowerCase()];
    if (m === undefined) return null;
    return toISO(parseInt(monthYear[2]), m, 15);
  }

  // "Q1 2026" etc.
  const quarter = s.match(/^Q([1-4])\s+(\d{4})$/);
  if (quarter) {
    const q = parseInt(quarter[1]);
    const year = parseInt(quarter[2]);
    const midMonths = [1, 4, 7, 10]; // Feb, May, Aug, Nov
    return toISO(year, midMonths[q - 1], 15);
  }

  // "H1 2026" / "H2 2026"
  const half = s.match(/^H([12])\s+(\d{4})$/);
  if (half) {
    const year = parseInt(half[2]);
    return toISO(year, half[1] === "1" ? 2 : 8, 15); // Mar or Sep
  }

  // "Aug 27, 2026" variant with no comma — already caught above
  // "FY27 Ramp" etc — skip
  return null;
}

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
      if (!c.dateBadge) continue;
      const iso = parseDateStr(c.dateBadge);
      if (!iso || iso < todayISO) continue;
      events.push({
        ticker: r.ticker,
        companyName: r.companyName,
        verdict: r.verdict,
        name: c.name,
        dateStr: c.dateBadge,
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
