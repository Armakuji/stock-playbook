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
  plannedSL: number;
  status: TradeStatus;
  exits: TradeExit[];
  realizedPnL?: number;             // computed on close; stored for speed
  notes?: string;
}

export interface JournalFile {
  _note: string;
  trades: Trade[];
}

export type ValidatorVerdict = "HOLD" | "CUT" | "WATCH";

export interface ValidatorResult {
  verdict: ValidatorVerdict;
  thesisIntact: boolean;
  stopBreached: boolean;
  atRisk: boolean;
  summary: string;
  action: string;
  color: "green" | "yellow" | "red";
}

export interface JournalValidation {
  _note: string;
  generatedAt: string; // ISO timestamp
  results: Record<string, ValidatorResult>; // keyed by ticker
}
