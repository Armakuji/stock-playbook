import { Prisma } from "@prisma/client";
import { ValidationResult } from "./trade-rules";

/** Fields written to trade_validations on create/update (excludes tradeId). */
export type TradeValidationWrite = Pick<
  Prisma.TradeValidationUncheckedCreateInput,
  | "verdict"
  | "thesisIntact"
  | "tightStopBreached"
  | "hardStopBreached"
  | "atRisk"
  | "slBufferPct"
  | "addMore"
  | "stopDecision"
  | "summary"
  | "summaryTh"
  | "action"
  | "actionTh"
  | "color"
  | "validatedAt"
>;

export function toTradeValidationWrite(
  r: ValidationResult,
  validatedAt: Date,
): TradeValidationWrite {
  return {
    verdict: r.verdict,
    thesisIntact: r.thesisIntact,
    tightStopBreached: r.tightStopBreached,
    hardStopBreached: r.hardStopBreached,
    atRisk: r.atRisk,
    slBufferPct: r.slBufferPct,
    addMore: r.addMore,
    stopDecision: r.stopDecision,
    summary: r.summary,
    summaryTh: r.summaryTh,
    action: r.action,
    actionTh: r.actionTh,
    color: r.color,
    validatedAt,
  };
}
