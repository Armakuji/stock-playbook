import { Prisma } from "@prisma/client";
import { ValidationToolResult } from "./prompt";

/** Fields written to trade_validations on create/update (excludes tradeId). */
export type TradeValidationWrite = Pick<
  Prisma.TradeValidationUncheckedCreateInput,
  | "verdict"
  | "thesisIntact"
  | "stopBreached"
  | "atRisk"
  | "summary"
  | "summaryTh"
  | "action"
  | "actionTh"
  | "color"
  | "validatedAt"
>;

export function toTradeValidationWrite(
  r: ValidationToolResult,
  validatedAt: Date,
): TradeValidationWrite {
  return {
    verdict: r.verdict,
    thesisIntact: r.thesisIntact,
    stopBreached: r.stopBreached,
    atRisk: r.atRisk,
    summary: r.summary,
    summaryTh: r.summaryTh,
    action: r.action,
    actionTh: r.actionTh,
    color: r.color,
    validatedAt,
  };
}
