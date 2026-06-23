// ─── Catalyst ────────────────────────────────────────────────────────────────

export interface Catalyst {
  icon?: string;
  name: string;
  description: string;
  /** Short label shown on a small badge beside the name, e.g. "2 DAYS" */
  urgencyLabel?: string;
  /** Date string shown as a colored pill, e.g. "Jun 17, 2026" */
  dateBadge?: string;
  /** Machine-readable event date (ISO YYYY-MM-DD). Drives timing sort & clustering;
   *  falls back to parsing dateBadge when omitted. Set this for the primary catalyst. */
  catalystDate?: string;
  /** Color of the date pill */
  badgeColor?: "red" | "yellow" | "green" | "blue";
  /** Color of the left-side dot indicator */
  dotColor?: "red" | "yellow" | "green" | "gray";
}

// ─── Entry Strategy ──────────────────────────────────────────────────────────

export interface EntryLevel {
  label: string;          // e.g. "Entry 1"
  /** Lower bound of price range (or exact price if rangeMax is omitted) */
  level: number;
  rangeMax?: number;      // if set, displayed as "$level–$rangeMax"
  note?: string;          // e.g. "Post-launch sell the news dip"
  timing?: string;        // e.g. "Jun 17–19" shown on the right
  preferred?: boolean;    // shows PREFERRED badge
}

export interface TargetLevel {
  price: number;
  pct?: number;           // e.g. 17.7 (shown as +17.7%)
  note?: string;
  moon?: boolean;         // shows 🌙 moon icon
}

export interface StopLoss {
  /** Tight stop — closest to entry */
  tight?: number;
  tightPct?: number;      // negative, e.g. -15
  tightNote?: string;
  /** Hard stop — max pain */
  hard?: number;
  hardPct?: number;
  hardNote?: string;
  /** Risk/Reward ratio string, e.g. "1.8 : 1" */
  riskReward?: string;
  rrNote?: string;
  rrWarning?: string;
  /** Legacy single stop-loss value */
  value?: number;
}

export interface EntryStrategy {
  entryLevels: EntryLevel[];
  tp1: TargetLevel;
  tp2: TargetLevel;
  tp3: TargetLevel;
  stopLoss: StopLoss;
  /** One-line overall verdict */
  verdict: string;
  approach: "DCA" | "Lump Sum" | "Scale In";
}

// ─── Estimate Dates ──────────────────────────────────────────────────────────

export interface EstimateDate {
  event: string;
  dateRange: string;      // e.g. "Jun 17–20"
  note?: string;
  est?: string;           // e.g. "est. $90–97"
  highlight?: "blue" | "yellow";
}

// ─── Scenario ────────────────────────────────────────────────────────────────

export interface Scenario {
  label: string;          // "Bear" | "Base" | "Bull" | "Moon"
  color: "red" | "yellow" | "green" | "purple";
  pct: number;            // e.g. -27 or 82
  price: number;
}

// ─── Macro / Fed Risk ────────────────────────────────────────────────────────

export interface MacroRisk {
  fedRisk: "LOW" | "MEDIUM" | "HIGH";
  rateOutlook: string;
  inflationNote: string;
  sectorImpact: string;
  summary: string;
}

// ─── Analyst Target ──────────────────────────────────────────────────────────

export interface AnalystTarget {
  firm: string;
  target: number;
  rating: string;
}

// ─── i18n (translations) ─────────────────────────────────────────────────────
// Top-level report fields are the English default.
// i18n.th contains Thai overrides — only fields present in th will be swapped.

export interface CatalystTranslation {
  name?: string;
  description?: string;
}

export interface EntryLevelTranslation {
  note?: string;
  timing?: string;
}

export interface MacroRiskTranslation {
  rateOutlook?: string;
  inflationNote?: string;
  sectorImpact?: string;
  summary?: string;
}

export interface EstimateDateTranslation {
  event?: string;
  note?: string;
}

export interface CatalystSpotTranslation {
  preRunup?: string;
  preRunupTiming?: string;
  earningsHistory?: { note?: string }[];
  postWin?: { note?: string };
  postLose?: { note?: string };
  spotSizing?: { reason?: string; breakdown?: { label?: string }[] };
  stopPreCatalyst?: { note?: string };
  stopPostCatalyst?: { note?: string };
}

export interface ComparableCaseTranslation {
  note?: string;
}

export interface ReportTranslation {
  summary?: string;
  priceNote?: string;
  scoreLabel?: string;
  catalysts?: CatalystTranslation[];
  risks?: string[];
  macroRisk?: MacroRiskTranslation;
  entryStrategy?: {
    verdict?: string;
    entryLevels?: EntryLevelTranslation[];
    tp1?: { note?: string };
    tp2?: { note?: string };
    tp3?: { note?: string };
    stopLoss?: {
      tightNote?: string;
      hardNote?: string;
      rrNote?: string;
      rrWarning?: string;
    };
  };
  estimateDates?: EstimateDateTranslation[];
  catalystSpot?: CatalystSpotTranslation;
  comparableCases?: ComparableCaseTranslation[];
}

export interface ReportI18n {
  th?: ReportTranslation;
}

// ─── Catalyst Spot Mode ──────────────────────────────────────────────────────

/** One historical earnings/catalyst reaction — used to build a credible sample */
export interface EarningsReaction {
  quarter: string;        // e.g. "Q3 FY25"
  date: string;           // e.g. "Sep 4, 2025"
  reactionPct: number;    // day-1 % move, e.g. 10 or -13
  outcome: "win" | "miss";
  note?: string;          // short driver, e.g. "$10B 4th AI customer"
}

/** One step in the spot position-sizing derivation */
export interface SizingStep {
  label: string;          // e.g. "Base — high-conviction BUY"
  value: string;          // e.g. "10%" or "−3pt"
  total?: boolean;        // marks the final resulting number
}

export interface CatalystSpot {
  /** e.g. "earnings_beat", "satellite_launch", "fda_decision", "foundry_validation" */
  catalystType: string;
  /** How the stock typically moves in the run-up period before the event */
  preRunup: string;
  preRunupTiming: string;  // e.g. "1–2 สัปดาห์ก่อน event"
  preRunupPct: string;     // e.g. "+8–15%"
  /** Per-quarter reaction sample (4–6+ quarters) backing the averages below */
  earningsHistory?: EarningsReaction[];
  /** What happens historically if catalyst succeeds */
  postWin: { avgPct: number; range: string; note: string; exampleDate?: string };
  /** What happens historically if catalyst fails */
  postLose: { avgPct: number; range: string; note: string; exampleDate?: string };
  /** Spot position sizing recommendation */
  spotSizing: { pct: number; reason: string; breakdown?: SizingStep[] };
  /** Stop loss BEFORE the catalyst event (thesis breach) */
  stopPreCatalyst: { pct: number; price?: number; note: string };
  /** Stop loss AFTER the catalyst event (if result is bad) */
  stopPostCatalyst: { pct: number; note: string };
}

export interface ComparableCase {
  ticker: string;
  event: string;
  date: string;
  movePct: number;
  days: number;
  outcome: "good" | "mixed" | "bad";
  note: string;
}

// ─── Score breakdown ─────────────────────────────────────────────────────────
// One line of the deterministic score derivation (see web/lib/scoring.ts).

export interface ScoreComponent {
  label: string;     // e.g. "Analyst upside"
  points: number;    // contribution toward the 0–100 total
  max: number;       // max this component can contribute
  detail: string;    // human-readable basis, e.g. "+38% to median $165"
}

// ─── Main Report ─────────────────────────────────────────────────────────────

export interface StockReport {
  ticker: string;
  companyName: string;
  /** One-line business type, e.g. "AI GPU · Dominant H100/Blackwell chips + CUDA ecosystem" */
  companyDescription?: string;
  exchange?: string;
  generatedAt: string;      // ISO date string
  price: number;
  priceChange: number;      // percent
  priceNote?: string;       // e.g. "ลงจาก high $97.56 · High risk play"
  marketCap?: string;
  sector: string;
  verdict: "BUY" | "HOLD" | "SELL" | "SPECULATIVE";
  scoreLabel?: string;      // e.g. "Core Holding", "ค่าขนม", "Speculative"
  score?: number;
  /** Deterministic score derivation — attached at load time by withComputedScore() */
  scoreBreakdown?: ScoreComponent[];
  /** Optional explicit factor tags (e.g. "ai_semi", "long_duration_rate"); the rest
   *  are derived in web/lib/factors.ts for correlated-risk warnings. */
  factorTags?: string[];
  summary: string;
  catalysts: Catalyst[];
  risks: string[];
  estimateDates?: EstimateDate[];
  scenarios?: Scenario[];
  analystTargets?: AnalystTarget[];
  macroRisk: MacroRisk;
  entryStrategy: EntryStrategy;
  earningsDate?: string;
  catalystSpot?: CatalystSpot;
  comparableCases?: ComparableCase[];
  /** Optional news link explaining the latest rank/verdict change — stored in JSON at report time */
  rankChangeSource?: { headline: string; url: string; date: string };
  sources: string[];
  i18n?: ReportI18n;
}
