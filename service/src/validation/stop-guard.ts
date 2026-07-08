import { ValidationToolResult } from "./prompt";

export interface StopGuardInput {
  currentPrice: number | null;
  plannedSL: number;
}

export interface StopGuardOutcome {
  result: ValidationToolResult;
  overridden: boolean;
}

const AT_RISK_BUFFER = 1.03; // matches the "within 3% above SL" rule in the system prompt

/**
 * Deterministic, code-only recheck of stopBreached/atRisk against the actual
 * numbers — a last line of defense against prompt injection (via `notes` or
 * `news` headlines) tricking the model into reporting a healthier state than
 * reality. "Is currentPrice <= plannedSL" is pure arithmetic; it should never
 * depend on the model choosing to believe an attacker's text.
 *
 * If the model's stopBreached is wrong, we don't just fix that one field —
 * we also force verdict/color to CUT/red when the stop is actually breached,
 * since a breached stop is the one fact an attacker would most want hidden
 * and the model's own verdict can't be trusted once its inputs were
 * (unreliably) followed.
 */
export function applyStopGuard(
  result: ValidationToolResult,
  trade: StopGuardInput,
): StopGuardOutcome {
  if (trade.currentPrice === null) {
    // No ground truth to check against — leave the model's answer as-is.
    return { result, overridden: false };
  }

  const actualStopBreached = trade.currentPrice <= trade.plannedSL;
  const actualAtRisk =
    !actualStopBreached &&
    trade.currentPrice <= trade.plannedSL * AT_RISK_BUFFER;

  const mismatch =
    result.stopBreached !== actualStopBreached ||
    result.atRisk !== actualAtRisk;
  if (!mismatch) {
    return { result, overridden: false };
  }

  const corrected: ValidationToolResult = {
    ...result,
    stopBreached: actualStopBreached,
    atRisk: actualAtRisk,
  };
  if (actualStopBreached && result.verdict !== "CUT") {
    corrected.verdict = "CUT";
    corrected.color = "red";
  }

  return { result: corrected, overridden: true };
}
