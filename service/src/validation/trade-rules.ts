// Deterministic rules engine for AI validation.
//
// Everything that is pure arithmetic or a fixed policy lives here — NOT in the
// model: stop flags, SL buffer %, the "buffer < 8% → at least WATCH" floor,
// the hard/tight stop flow, "don't add unless HOLD", and color-from-verdict.
// The model only contributes judgment (thesisIntact, HOLD vs WATCH vs CUT
// when nothing forces it, BUY_DIP vs WAIT, hold-to-hard-stop vs cut) plus
// the prose. This is also the last line of defense against prompt injection
// via `notes` / news headlines: no text can make a breached stop look healthy.

export type Verdict = "HOLD" | "WATCH" | "CUT";
export type AddMore = "BUY_DIP" | "WAIT" | "DONT_ADD";
export type StopDecision = "HOLD_TO_HARD_STOP" | "CUT_NOW" | "EXIT_IMMEDIATELY";
export type ModelStopDecision = StopDecision | "NOT_APPLICABLE";
export type Color = "green" | "yellow" | "red";

export type StopStatus =
  | "UNKNOWN" // no live price
  | "OK"
  | "THIN_BUFFER" // SL buffer < WATCH_BUFFER_PCT
  | "AT_RISK" // price within AT_RISK_BUFFER of SL
  | "TIGHT_BREACHED" // price <= plannedSL (and above hard stop, if any)
  | "HARD_BREACHED"; // price <= plannedHardSL

/** price <= SL × 1.03 → AT_RISK (unchanged from the original stop guard). */
export const AT_RISK_BUFFER = 1.03;
/** CLI analyze-journal rule: SL buffer < 8% of price → at least WATCH. */
export const WATCH_BUFFER_PCT = 8;

const EPS = 1e-9;

export interface RuleTradeInput {
  entryPrice: number;
  shares: number;
  exitedShares: number;
  entryDate: string; // YYYY-MM-DD
  plannedTP: number[];
  plannedSL: number;
  plannedHardSL: number | null;
  currentPrice: number | null;
}

export interface TradeMetrics {
  remainingShares: number;
  holdingDays: number;
  /** Hard stop actually in effect — null when unset or not below plannedSL. */
  effectiveHardSL: number | null;
  pctFromEntry: number | null;
  /** (price − SL) / price × 100 — same convention as the CLI skill. */
  slBufferPct: number | null;
  hardSlBufferPct: number | null;
  tpDistancePct: (number | null)[];
  stopStatus: StopStatus;
  tightStopBreached: boolean;
  hardStopBreached: boolean;
  atRisk: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function isFullyExited(shares: number, exitedShares: number): boolean {
  return shares - exitedShares <= EPS;
}

export function computeTradeMetrics(
  t: RuleTradeInput,
  today: Date = new Date(),
): TradeMetrics {
  const remainingShares = Math.max(0, t.shares - t.exitedShares);
  const entryMs = Date.parse(`${t.entryDate}T00:00:00Z`);
  const holdingDays = Number.isFinite(entryMs)
    ? Math.max(0, Math.floor((today.getTime() - entryMs) / 86_400_000))
    : 0;
  const effectiveHardSL =
    t.plannedHardSL !== null &&
    t.plannedHardSL > 0 &&
    t.plannedHardSL < t.plannedSL
      ? t.plannedHardSL
      : null;

  const p = t.currentPrice;
  if (p === null || !(p > 0)) {
    return {
      remainingShares,
      holdingDays,
      effectiveHardSL,
      pctFromEntry: null,
      slBufferPct: null,
      hardSlBufferPct: null,
      tpDistancePct: t.plannedTP.map(() => null),
      stopStatus: "UNKNOWN",
      tightStopBreached: false,
      hardStopBreached: false,
      atRisk: false,
    };
  }

  const hardStopBreached = effectiveHardSL !== null && p <= effectiveHardSL;
  const tightStopBreached = t.plannedSL > 0 && p <= t.plannedSL;
  const atRisk =
    !tightStopBreached && t.plannedSL > 0 && p <= t.plannedSL * AT_RISK_BUFFER;
  const slBufferPct =
    t.plannedSL > 0 ? round1(((p - t.plannedSL) / p) * 100) : null;

  let stopStatus: StopStatus = "OK";
  if (hardStopBreached) stopStatus = "HARD_BREACHED";
  else if (tightStopBreached) stopStatus = "TIGHT_BREACHED";
  else if (atRisk) stopStatus = "AT_RISK";
  else if (slBufferPct !== null && slBufferPct < WATCH_BUFFER_PCT)
    stopStatus = "THIN_BUFFER";

  return {
    remainingShares,
    holdingDays,
    effectiveHardSL,
    pctFromEntry:
      t.entryPrice > 0
        ? round1(((p - t.entryPrice) / t.entryPrice) * 100)
        : null,
    slBufferPct,
    hardSlBufferPct:
      effectiveHardSL !== null
        ? round1(((p - effectiveHardSL) / p) * 100)
        : null,
    tpDistancePct: t.plannedTP.map((tp) =>
      tp > 0 ? round1(((tp - p) / p) * 100) : null,
    ),
    stopStatus,
    tightStopBreached,
    hardStopBreached,
    atRisk,
  };
}

/** What the model returns per trade (see VALIDATION_TOOL in prompt.ts). */
export interface ModelValidation {
  tradeId: string;
  verdict: Verdict;
  thesisIntact: boolean;
  addMore: AddMore;
  stopDecision: ModelStopDecision;
  summary: string;
  summaryTh: string;
  action: string;
  actionTh: string;
}

/** Final, rule-enforced result — what gets persisted and returned. */
export interface ValidationResult {
  tradeId: string;
  verdict: Verdict;
  thesisIntact: boolean;
  tightStopBreached: boolean;
  hardStopBreached: boolean;
  atRisk: boolean;
  slBufferPct: number | null;
  addMore: AddMore;
  stopDecision: StopDecision | null;
  summary: string;
  summaryTh: string;
  action: string;
  actionTh: string;
  color: Color;
}

export const VERDICT_COLOR: Record<Verdict, Color> = {
  HOLD: "green",
  WATCH: "yellow",
  CUT: "red",
};

export interface RuleOutcome {
  result: ValidationResult;
  /** Human-readable list of what code changed vs the model's answer. */
  overrides: string[];
}

interface TextPair {
  summary: string;
  summaryTh: string;
  action: string;
  actionTh: string;
}

const $ = (n: number) => `$${Number(n.toFixed(2))}`;

function ruleText(
  kind:
    | "HARD_BREACHED"
    | "TIGHT_CUT"
    | "TIGHT_HOLD_TO_HARD"
    | "THIN_BUFFER"
    | "PRICE_UNKNOWN",
  t: RuleTradeInput,
  m: TradeMetrics,
): TextPair {
  const price = t.currentPrice ?? 0;
  const sl = $(t.plannedSL);
  const buf = m.slBufferPct ?? 0;
  switch (kind) {
    case "HARD_BREACHED": {
      const hard = $(m.effectiveHardSL ?? 0);
      return {
        summary: `Price ${$(price)} is at/below the hard stop ${hard} — the structural level has failed, so the original plan no longer protects this position.`,
        summaryTh: `ราคา ${$(price)} หลุด hard stop ${hard} แล้ว — แนวรับเชิงโครงสร้างเสีย แผนเดิมไม่คุ้มครอง position นี้อีกต่อไป`,
        action: `CUT — exit now, hard stop ${hard} breached. Don't add.`,
        actionTh: `CUT — ออกทันที หลุด hard stop ${hard} · ห้ามเติม`,
      };
    }
    case "TIGHT_CUT":
      return {
        summary: `Price ${$(price)} is at/below the stop loss ${sl}.`,
        summaryTh: `ราคา ${$(price)} หลุด stop loss ${sl} แล้ว`,
        action: `CUT — stop loss ${sl} hit, exit per plan. Don't add.`,
        actionTh: `CUT — ชน stop loss ${sl} ออกตามแผน · ห้ามเติม`,
      };
    case "TIGHT_HOLD_TO_HARD": {
      const hard = $(m.effectiveHardSL ?? 0);
      const hb = m.hardSlBufferPct ?? 0;
      return {
        summary: `Price ${$(price)} broke the tight stop ${sl} but is still ${hb}% above the hard stop ${hard}.`,
        summaryTh: `ราคา ${$(price)} หลุด tight stop ${sl} แต่ยังเหนือ hard stop ${hard} อยู่ ${hb}%`,
        action: `WATCH — hold to hard stop ${hard} at reduced size (~50%). Don't add.`,
        actionTh: `WATCH — ถือต่อถึง hard stop ${hard} โดยลดขนาดลง ~50% · ห้ามเติม`,
      };
    }
    case "THIN_BUFFER":
      return {
        summary: `Price ${$(price)} is only ${buf}% above the stop loss ${sl} — the buffer is thin (< ${WATCH_BUFFER_PCT}%).`,
        summaryTh: `ราคา ${$(price)} เหลือ buffer เหนือ stop loss ${sl} แค่ ${buf}% — บางเกินไป (< ${WATCH_BUFFER_PCT}%)`,
        action: `WATCH — SL buffer ${buf}%. Don't add until price rebuilds a cushion above ${sl}.`,
        actionTh: `WATCH — SL buffer เหลือ ${buf}% · ยังไม่เติมจนกว่าราคาจะดีดห่างจาก ${sl}`,
      };
    case "PRICE_UNKNOWN":
      return {
        summary:
          "Live price unavailable — stop and target distances could not be verified.",
        summaryTh: "ดึงราคาล่าสุดไม่ได้ — เช็คระยะ stop/เป้าไม่ได้",
        action:
          "WATCH — re-run the scan once price data is available. Don't add blind.",
        actionTh: "WATCH — สแกนใหม่เมื่อมีข้อมูลราคา · อย่าเติมโดยไม่เห็นราคา",
      };
  }
}

/**
 * Apply every fixed rule on top of the model's judgment. Precedence:
 *   UNKNOWN price  → HOLD downgraded to WATCH
 *   HARD_BREACHED  → CUT / EXIT_IMMEDIATELY
 *   TIGHT_BREACHED → no hard stop: CUT / CUT_NOW
 *                    hard stop:    model picks HOLD_TO_HARD_STOP (→ WATCH) or CUT
 *   AT_RISK / THIN_BUFFER → HOLD downgraded to WATCH
 *   then: verdict ≠ HOLD → addMore DONT_ADD; color = f(verdict)
 * When code changes the verdict, the model's prose would contradict the badge,
 * so summary + action are replaced with a deterministic template. When only
 * addMore changes, just the action line is replaced.
 */
export function applyTradeRules(
  model: ModelValidation,
  t: RuleTradeInput,
  m: TradeMetrics,
): RuleOutcome {
  const overrides: string[] = [];
  let verdict: Verdict = model.verdict;
  let stopDecision: StopDecision | null = null;
  let text: TextPair | null = null;

  switch (m.stopStatus) {
    case "UNKNOWN":
      if (verdict === "HOLD") {
        verdict = "WATCH";
        text = ruleText("PRICE_UNKNOWN", t, m);
      }
      break;
    case "HARD_BREACHED":
      verdict = "CUT";
      stopDecision = "EXIT_IMMEDIATELY";
      if (model.verdict !== "CUT") text = ruleText("HARD_BREACHED", t, m);
      break;
    case "TIGHT_BREACHED":
      if (m.effectiveHardSL === null) {
        verdict = "CUT";
        stopDecision =
          model.stopDecision === "EXIT_IMMEDIATELY"
            ? "EXIT_IMMEDIATELY"
            : "CUT_NOW";
        if (model.verdict !== "CUT") text = ruleText("TIGHT_CUT", t, m);
      } else {
        const decision: StopDecision =
          model.stopDecision !== "NOT_APPLICABLE"
            ? model.stopDecision
            : model.verdict === "CUT"
              ? "CUT_NOW"
              : "HOLD_TO_HARD_STOP";
        stopDecision = decision;
        verdict = decision === "HOLD_TO_HARD_STOP" ? "WATCH" : "CUT";
        if (verdict !== model.verdict)
          text = ruleText(
            verdict === "WATCH" ? "TIGHT_HOLD_TO_HARD" : "TIGHT_CUT",
            t,
            m,
          );
      }
      break;
    case "AT_RISK":
    case "THIN_BUFFER":
      if (verdict === "HOLD") {
        verdict = "WATCH";
        text = ruleText("THIN_BUFFER", t, m);
      }
      break;
    case "OK":
      break;
  }
  if (verdict !== model.verdict)
    overrides.push(`verdict ${model.verdict}→${verdict} (${m.stopStatus})`);
  if (
    model.stopDecision !== "NOT_APPLICABLE" &&
    stopDecision !== model.stopDecision
  )
    overrides.push(
      `stopDecision ${model.stopDecision}→${stopDecision ?? "null"}`,
    );

  let addMore: AddMore = model.addMore;
  if (verdict !== "HOLD" && addMore !== "DONT_ADD") {
    overrides.push(`addMore ${addMore}→DONT_ADD (verdict ${verdict})`);
    addMore = "DONT_ADD";
    if (!text) {
      text = {
        summary: model.summary,
        summaryTh: model.summaryTh,
        action: `${verdict} — don't add more while the position is on ${verdict}.`,
        actionTh: `${verdict} — ยังไม่ควรเติมระหว่างที่สถานะเป็น ${verdict}`,
      };
    }
  }

  const prose = text ?? {
    summary: model.summary,
    summaryTh: model.summaryTh,
    action: model.action,
    actionTh: model.actionTh,
  };

  return {
    result: {
      tradeId: model.tradeId,
      verdict,
      thesisIntact: model.thesisIntact,
      tightStopBreached: m.tightStopBreached,
      hardStopBreached: m.hardStopBreached,
      atRisk: m.atRisk,
      slBufferPct: m.slBufferPct,
      addMore,
      stopDecision,
      ...prose,
      color: VERDICT_COLOR[verdict],
    },
    overrides,
  };
}
