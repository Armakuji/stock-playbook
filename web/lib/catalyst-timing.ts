// ─── catalyst-timing.ts — structured catalyst dates & timing ────────────────
// CLIENT-SAFE: pure functions, no fs. Powers the "30% catalyst hunter" timing:
// how many days to the next event, tier-sorting, and event-day clustering.
//
// Date source priority: explicit Catalyst.catalystDate (ISO) → else parse the
// human dateBadge string. So existing reports work immediately via dateBadge,
// and new reports can pin an exact ISO date.

import { StockReport, Catalyst } from "./types";

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Parse a loose date string ("Jul 2, 2026" / "Aug 2026" / "Q3 2026" / "H1 2026") → YYYY-MM-DD, or null. */
export function parseDateStr(raw?: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  let m = s.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) { const mo = MONTH_MAP[m[1].toLowerCase()]; return mo === undefined ? null : iso(+m[3], mo, +m[2]); }

  m = s.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (m) { const mo = MONTH_MAP[m[1].toLowerCase()]; return mo === undefined ? null : iso(+m[2], mo, 15); }

  m = s.match(/^Q([1-4])\s+(\d{4})$/);
  if (m) { const mid = [1, 4, 7, 10]; return iso(+m[2], mid[+m[1] - 1], 15); }

  m = s.match(/^H([12])\s+(\d{4})$/);
  if (m) { return iso(+m[2], m[1] === "1" ? 2 : 8, 15); }

  return null;
}

/** Resolve a catalyst's ISO date — explicit catalystDate wins, else parse dateBadge. */
export function catalystISO(c: Catalyst): string | null {
  if (c.catalystDate && /^\d{4}-\d{2}-\d{2}$/.test(c.catalystDate)) return c.catalystDate;
  return parseDateStr(c.dateBadge);
}

/** A "~"-prefixed dateBadge ("~Q4 2026", "~Aug 12") marks a genuinely fuzzy
 *  catalyst window. Its catalystDate (if any) is the window's END bound — good
 *  enough to tell when the event has passed (reportStage / lastCatalyst), but
 *  NOT a real event day, so it must never drive proximity sorting, the
 *  calendar, or event-day clustering. Mirrored in scripts/validate-reports.mjs. */
export function isFuzzyBadge(raw?: string): boolean {
  return typeof raw === "string" && raw.trim().startsWith("~");
}

/** catalystISO for proximity use — null for fuzzy (~) catalysts. */
export function proximityISO(c: Catalyst): string | null {
  return isFuzzyBadge(c.dateBadge) ? null : catalystISO(c);
}

export function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenISO(fromISO: string, toISO: string): number {
  return Math.round(
    (new Date(toISO + "T00:00:00Z").getTime() - new Date(fromISO + "T00:00:00Z").getTime()) / 86_400_000
  );
}

export interface NextCatalyst { iso: string; name: string; days: number; }

/** Soonest upcoming catalyst (catalysts[] first, then estimateDates[]). null if none upcoming.
 *  Fuzzy (~) catalysts are skipped — see isFuzzyBadge. */
export function nextCatalyst(report: StockReport, ref?: string): NextCatalyst | null {
  const base = ref ?? todayISO();
  const cands: { iso: string; name: string }[] = [];
  for (const c of report.catalysts ?? []) { const d = proximityISO(c); if (d) cands.push({ iso: d, name: c.name }); }
  for (const e of report.estimateDates ?? []) { const d = parseDateStr(e.dateRange); if (d) cands.push({ iso: d, name: e.event }); }
  const upcoming = cands.filter((c) => c.iso >= base).sort((a, b) => a.iso.localeCompare(b.iso));
  if (!upcoming.length) return null;
  return { iso: upcoming[0].iso, name: upcoming[0].name, days: daysBetweenISO(base, upcoming[0].iso) };
}

export function daysToCatalyst(report: StockReport, ref?: string): number | null {
  return nextCatalyst(report, ref)?.days ?? null;
}

export interface LastCatalyst { iso: string; name: string; daysAgo: number; }

/** Most recently PASSED catalyst (catalysts[] first, then estimateDates[]) —
 *  the date closest to today among all past dates, so "days since event"
 *  reflects whichever catalyst actually just resolved. null if none passed.
 *  Powers the "post" stage badge (see reportStage below). */
export function lastCatalyst(report: StockReport, ref?: string): LastCatalyst | null {
  const base = ref ?? todayISO();
  const cands: { iso: string; name: string }[] = [];
  for (const c of report.catalysts ?? []) { const d = catalystISO(c); if (d) cands.push({ iso: d, name: c.name }); }
  for (const e of report.estimateDates ?? []) { const d = parseDateStr(e.dateRange); if (d) cands.push({ iso: d, name: e.event }); }
  const past = cands.filter((c) => c.iso < base).sort((a, b) => b.iso.localeCompare(a.iso));
  if (!past.length) return null;
  return { iso: past[0].iso, name: past[0].name, daysAgo: daysBetweenISO(past[0].iso, base) };
}

export function daysSinceCatalyst(report: StockReport, ref?: string): number | null {
  return lastCatalyst(report, ref)?.daysAgo ?? null;
}

export type ReportStage = "pre" | "post" | "undated";

/**
 * Where a pick sits relative to its catalyst:
 *   pre     — has a dated catalyst still ahead (active hunt)
 *   post    — had dated catalyst(s), all now in the past (event happened → realized/monitoring)
 *   undated — no parseable catalyst date at all
 * "post" picks are kept (backtest reads them) but moved off the active board.
 */
export function reportStage(report: StockReport, ref?: string): ReportStage {
  const base = ref ?? todayISO();
  const dates: string[] = [];
  for (const c of report.catalysts ?? []) { const d = catalystISO(c); if (d) dates.push(d); }
  for (const e of report.estimateDates ?? []) { const d = parseDateStr(e.dateRange); if (d) dates.push(d); }
  if (dates.length === 0) return "undated";
  return dates.some((d) => d >= base) ? "pre" : "post";
}

/**
 * Timing tier for sorting (lower = more urgent):
 *   0 imminent ≤3d · 1 this week ≤10d · 2 building ≤21d · 3 far / no dated catalyst
 * Soft, not a hard filter — far/undated picks still rank (just last), because
 * pre-run-up accumulation 1–2 weeks out is part of the edge.
 */
export function timingTier(days: number | null): number {
  if (days === null) return 3;
  if (days <= 3) return 0;
  if (days <= 10) return 1;
  if (days <= 21) return 2;
  return 3;
}

// ── Catalyst type (event-driven grouping) ──────────────────────────────────

/** Primary catalyst type from catalystSpot.catalystType (which may be "a + b + c"). */
export function primaryCatalystType(report: StockReport): string {
  const raw = report.catalystSpot?.catalystType;
  if (!raw) return "other";
  const first = raw.split(/[+,/]/)[0].trim().toLowerCase().replace(/\s+/g, "_");
  return first || "other";
}

export const CATALYST_TYPE_META: Record<string, { label: string; icon: string }> = {
  earnings_beat:       { label: "Earnings",                  icon: "📊" },
  foundry_validation:  { label: "Foundry / Chip Validation", icon: "🏭" },
  satellite_launch:    { label: "Satellite Launch",          icon: "🛰️" },
  delivery_beat:       { label: "Delivery / Volume",         icon: "🚚" },
  product_launch:      { label: "Product Launch",            icon: "🚀" },
  fda_decision:        { label: "FDA Decision",              icon: "💊" },
  phase3_readout:      { label: "Phase 3 Readout",           icon: "🧬" },
  partnership_win:     { label: "Partnership / Contract",    icon: "🤝" },
  regulatory_approval: { label: "Regulatory Approval",       icon: "⚖️" },
  design_win:          { label: "Design Win",                icon: "🧩" },
  macro:               { label: "Macro",                     icon: "🌐" },
  other:               { label: "Other Catalyst",            icon: "📦" },
};

export function catalystTypeMeta(type: string): { label: string; icon: string } {
  return CATALYST_TYPE_META[type] ?? { label: type.replace(/_/g, " "), icon: "📦" };
}

export interface CatalystCluster { iso: string; tickers: string[]; names: string[] }

/** Find groups of ≥minCount picks whose next catalyst falls within a windowDays span — event-day risk. */
export function detectCatalystClusters(
  reports: StockReport[], windowDays = 3, minCount = 3, ref?: string,
): CatalystCluster[] {
  const base = ref ?? todayISO();
  const items = reports
    .map((r) => { const n = nextCatalyst(r, base); return n ? { ticker: r.ticker, iso: n.iso, name: n.name } : null; })
    .filter((x): x is { ticker: string; iso: string; name: string } => !!x)
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const clusters: CatalystCluster[] = [];
  const used = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < items.length; j++) {
      if (!used.has(j) && daysBetweenISO(items[i].iso, items[j].iso) <= windowDays) group.push(j);
    }
    if (group.length >= minCount) {
      group.forEach((g) => used.add(g));
      clusters.push({
        iso: items[i].iso,
        tickers: group.map((g) => items[g].ticker),
        names: group.map((g) => items[g].name),
      });
    }
  }
  return clusters;
}
