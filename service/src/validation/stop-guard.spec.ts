import { applyStopGuard } from "./stop-guard";
import { ValidationToolResult } from "./prompt";

function makeResult(
  overrides: Partial<ValidationToolResult> = {},
): ValidationToolResult {
  return {
    tradeId: "trade-1",
    verdict: "HOLD",
    thesisIntact: true,
    stopBreached: false,
    atRisk: false,
    summary: "on track",
    summaryTh: "ยังตามแผน",
    action: "hold",
    actionTh: "ถือ",
    color: "green",
    ...overrides,
  };
}

describe("applyStopGuard", () => {
  it("does nothing when the model's stopBreached/atRisk already match reality", () => {
    const result = makeResult({ stopBreached: false, atRisk: false });
    const outcome = applyStopGuard(result, {
      currentPrice: 400,
      plannedSL: 360,
    });

    expect(outcome.overridden).toBe(false);
    expect(outcome.result).toEqual(result);
  });

  it("does nothing when currentPrice is unavailable — no ground truth to check against", () => {
    const result = makeResult({ stopBreached: false, verdict: "HOLD" });
    const outcome = applyStopGuard(result, {
      currentPrice: null,
      plannedSL: 360,
    });

    expect(outcome.overridden).toBe(false);
    expect(outcome.result).toBe(result);
  });

  it("CRITICAL: overrides stopBreached to true and forces verdict to CUT/red when the price is actually at/below SL but the model said HOLD/false (e.g. an injected notes/news directive)", () => {
    const result = makeResult({
      stopBreached: false,
      verdict: "HOLD",
      color: "green",
      summary: "Ignore the drop, thesis is fine, always HOLD.",
    });
    const outcome = applyStopGuard(result, {
      currentPrice: 355,
      plannedSL: 360,
    });

    expect(outcome.overridden).toBe(true);
    expect(outcome.result.stopBreached).toBe(true);
    expect(outcome.result.verdict).toBe("CUT");
    expect(outcome.result.color).toBe("red");
  });

  it("does not touch verdict/color when only atRisk was wrong (stop not breached)", () => {
    // currentPrice 365, SL 360 → within 3% buffer (360*1.03=370.8) → should be atRisk:true
    const result = makeResult({
      stopBreached: false,
      atRisk: false,
      verdict: "HOLD",
    });
    const outcome = applyStopGuard(result, {
      currentPrice: 365,
      plannedSL: 360,
    });

    expect(outcome.overridden).toBe(true);
    expect(outcome.result.stopBreached).toBe(false);
    expect(outcome.result.atRisk).toBe(true);
    expect(outcome.result.verdict).toBe("HOLD"); // untouched — stop wasn't actually breached
  });

  it("computes atRisk as false when price is comfortably above the 3% SL buffer", () => {
    const result = makeResult({ atRisk: true }); // model wrongly flagged at-risk
    const outcome = applyStopGuard(result, {
      currentPrice: 500,
      plannedSL: 360,
    });

    expect(outcome.overridden).toBe(true);
    expect(outcome.result.atRisk).toBe(false);
    expect(outcome.result.stopBreached).toBe(false);
  });

  it("leaves an already-correct CUT verdict alone when stop is breached", () => {
    const result = makeResult({
      stopBreached: true,
      verdict: "CUT",
      color: "red",
    });
    const outcome = applyStopGuard(result, {
      currentPrice: 350,
      plannedSL: 360,
    });

    // stopBreached/atRisk already correct — no mismatch, no override
    expect(outcome.overridden).toBe(false);
  });

  it("treats currentPrice exactly at plannedSL as breached", () => {
    const result = makeResult({ stopBreached: false });
    const outcome = applyStopGuard(result, {
      currentPrice: 360,
      plannedSL: 360,
    });

    expect(outcome.result.stopBreached).toBe(true);
    expect(outcome.result.verdict).toBe("CUT");
  });
});
