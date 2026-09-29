// ─── Trade Journal types ─────────────────────────────────────────────────────
// PRIVATE: these types are used only by the local journal page.
// They are NEVER imported by any public report component or Vercel build path.

export type CatalystType =
  | "earnings_beat"
  | "satellite_launch"
  | "fda_decision"
  | "foundry_validation"
  | "delivery_beat"
  | "partnership_win"
  | "product_launch"
  | "regulatory_approval"
  | "phase3_readout"
  | "design_win"
  | "macro"
  | "other";

export type TradeStatus = "open" | "closed";

export interface TradeExit {
  date: string;        // ISO date
  price: number;
  shares: number;
  note?: string;
}

export interface Trade {
  id: string;                       // UUID or timestamp slug
  ticker: string;
  linkedReportDate?: string;        // "YYYYMMDD" — links to web/data/reports/<TICKER>_<DATE>.json
  catalystType: CatalystType;
  entryPrice: number;
  shares: number;
  entryDate: string;                // ISO date
  plannedTP: number[];              // [tp1, tp2, tp3]
  plannedSL: number;                // tight stop
  plannedHardSL?: number | null;    // optional structural stop below plannedSL
  status: TradeStatus;
  exits: TradeExit[];
  realizedPnL?: number;             // computed on close; stored for speed
  notes?: string;
  validation?: TradeValidationRecord | null;
}

export interface JournalFile {
  _note: string;
  trades: Trade[];
}

export type ValidatorVerdict = "HOLD" | "CUT" | "WATCH";
export type AddMoreCall = "BUY_DIP" | "WAIT" | "DONT_ADD";
export type StopDecision = "HOLD_TO_HARD_STOP" | "CUT_NOW" | "EXIT_IMMEDIATELY";

export interface ValidatorResult {
  verdict: ValidatorVerdict;
  thesisIntact: boolean;
  // Stop flags, buffer and color are computed by the API's rules engine
  // (service/src/validation/trade-rules.ts), not by the model.
  tightStopBreached?: boolean;
  /** Legacy name (pre hard-stop split, CLI journal-validation.json) — same meaning as tightStopBreached. */
  stopBreached?: boolean;
  hardStopBreached?: boolean;
  atRisk: boolean;
  slBufferPct?: number | null;
  addMore?: AddMoreCall | null;
  stopDecision?: StopDecision | null;
  summary: string;
  summaryTh?: string;
  action: string;
  actionTh?: string;
  color: "green" | "yellow" | "red";
}

export interface TradeValidationRecord extends ValidatorResult {
  validatedAt: string; // ISO timestamp
}

export interface AiValidateQuota {
  used: number;
  limit: number;
  remaining: number;
}
