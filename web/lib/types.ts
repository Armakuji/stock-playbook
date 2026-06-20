// ─── Catalyst ────────────────────────────────────────────────────────────────

export interface Catalyst {
  icon?: string;
  name: string;
  description: string;
  /** Short label shown on a small badge beside the name, e.g. "2 DAYS" */
  urgencyLabel?: string;
  /** Date string shown as a colored pill, e.g. "Jun 17, 2026" */
  dateBadge?: string;
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

// ─── Main Report ─────────────────────────────────────────────────────────────

export interface StockReport {
  ticker: string;
  companyName: string;
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
  summary: string;
  catalysts: Catalyst[];
  risks: string[];
  estimateDates?: EstimateDate[];
  scenarios?: Scenario[];
  analystTargets?: AnalystTarget[];
  macroRisk: MacroRisk;
  entryStrategy: EntryStrategy;
  earningsDate?: string;
  sources: string[];
}
