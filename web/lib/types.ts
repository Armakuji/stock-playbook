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

// ─── DCA / Quality-Core Mode ─────────────────────────────────────────────────
// Optional fields used by the /dca page (quality long-term core holdings).
// Interpreted by web/lib/dca-scoring.ts, rendered by DcaCard.
// All optional → a normal catalyst/turbo report stays valid without them.

/** Where price sits vs estimated fair value — drives the "ซื้อได้ตอนนี้" gauge */
export interface ValuationBand {
  fairLow: number;        // bottom of fair-value range
  fairBase: number;       // central fair value estimate
  fairHigh: number;       // top of fair-value range
  /** % current price is above(+)/below(-) fairBase. e.g. -12 = 12% cheaper than fair */
  currentVsFair: number;
  zone: "cheap" | "fair" | "expensive";
  /** basis, e.g. "DCF + 25x fwd P/E blend" — should trace to a source */
  basis?: string;
}

/** One accumulation band on the DCA buy-zone bar */
export interface DcaBand {
  label: string;          // e.g. "Accumulate", "Hold", "Trim"
  low: number;            // band lower price bound
  high: number;           // band upper price bound
  action: "accumulate" | "hold" | "wait";
  note?: string;
}

/** The recurring-buy plan that replaces catalyst entry levels for DCA picks */
export interface DcaPlan {
  cadence: string;        // e.g. "Monthly", "Bi-weekly", "On 5%+ dips"
  bands: DcaBand[];
  targetWeight: string;   // intended weight in portfolio, e.g. "8–12%"
  note?: string;
}

/** 0–5 quality sub-scores; composite is derived if omitted */
export interface QualityScore {
  moat: number;           // durability of competitive advantage
  marginTrend: number;    // gross/operating margin stability or expansion
  fcf: number;            // free-cash-flow strength
  balanceSheet: number;   // debt / liquidity health
  composite?: number;     // 0–5 average (derived in dca-scoring if omitted)
  note?: string;
}

/** Light technical read for "is now a fine entry" — context, not a trade signal */
export interface TechnicalNote {
  above200dma?: boolean;
  rsi?: number;
  note?: string;          // e.g. "Above rising 200-DMA, RSI 54 — neutral"
}

/** ETF / fund metadata for the DCA "กองทุน" tab */
export interface FundInfo {
  tracks: string;          // index/strategy tracked, e.g. "S&P 500" / "Nasdaq-100"
  expenseRatio: number;    // annual %, e.g. 0.03
  yield?: number;          // distribution yield %, e.g. 1.3
  cagr10y?: number;        // ~10-yr annualized total return %, e.g. 13.5
  aum?: string;            // assets under management, e.g. "$600B"
  holdings?: number;       // number of holdings, e.g. 503
  issuer?: string;         // e.g. "Vanguard"
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
  // ── DCA / quality-core fields (only populated for /dca picks) ──────────────
  /** Fair-value band + where price sits — replaces catalyst countdown on DCA cards */
  valuationBand?: ValuationBand;
  /** Recurring accumulation plan — replaces entry levels for DCA */
  dcaPlan?: DcaPlan;
  /** DCA asset class — "stock" (default) or "fund" (ETF), drives the /dca tab split */
  assetType?: "stock" | "fund";
  /** ETF/fund metadata (only for assetType "fund") */
  fundInfo?: FundInfo;
  /** 0–5 quality sub-scores driving the DCA score */
  qualityScore?: QualityScore;
  /** Conditions that invalidate the long-term thesis (DCA's "stop loss") */
  thesisBreak?: string[];
  /** Light technical context for entry timing */
  technicalNote?: TechnicalNote;
  /** Attached at load time by web/lib/dca-scoring.ts for the /dca page */
  dcaScore?: number;
  dcaScoreBreakdown?: ScoreComponent[];
  /** Optional news link explaining the latest rank/verdict change — stored in JSON at report time */
  rankChangeSource?: { headline: string; url: string; date: string };
  sources: string[];
  i18n?: ReportI18n;
}
