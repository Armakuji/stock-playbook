import {
  ModelValidation,
  RuleTradeInput,
  applyTradeRules,
  computeTradeMetrics,
  isFullyExited,
} from "./trade-rules";

const TODAY = new Date("2026-09-30T12:00:00Z");

function trade(overrides: Partial<RuleTradeInput> = {}): RuleTradeInput {
  return {
    entryPrice: 100,
    shares: 10,
    exitedShares: 0,
    entryDate: "2026-09-01",
    plannedTP: [120, 140, 170],
    plannedSL: 90,
    plannedHardSL: null,
    currentPrice: 110,
    ...overrides,
  };
}

function model(overrides: Partial<ModelValidation> = {}): ModelValidation {
  return {
    tradeId: "t1",
    verdict: "HOLD",
    thesisIntact: true,
    addMore: "BUY_DIP",
    stopDecision: "NOT_APPLICABLE",
    summary: "model summary",
    summaryTh: "สรุปจากโมเดล",
    action: "model action",
    actionTh: "แอคชันจากโมเดล",
    ...overrides,
  };
}

function run(t: RuleTradeInput, m: ModelValidation) {
  return applyTradeRules(m, t, computeTradeMetrics(t, TODAY));
}

describe("computeTradeMetrics", () => {
  it("computes buffer as % of price (CLI convention), P&L, TP distances and holding days", () => {
    const m = computeTradeMetrics(trade(), TODAY);
    expect(m.slBufferPct).toBe(18.2); // (110-90)/110
    expect(m.pctFromEntry).toBe(10);
    expect(m.tpDistancePct).toEqual([9.1, 27.3, 54.5]);
    expect(m.holdingDays).toBe(29);
    expect(m.stopStatus).toBe("OK");
  });

  it("uses remaining shares after partial exits", () => {
    expect(
      computeTradeMetrics(trade({ exitedShares: 4 }), TODAY).remainingShares,
    ).toBe(6);
  });

  it("flags THIN_BUFFER below 8% but above the 3% at-risk band", () => {
    const m = computeTradeMetrics(trade({ currentPrice: 95 }), TODAY); // 5.3%
    expect(m.stopStatus).toBe("THIN_BUFFER");
    expect(m.atRisk).toBe(false);
  });

  it("flags AT_RISK within 3% above SL", () => {
    const m = computeTradeMetrics(trade({ currentPrice: 92 }), TODAY);
    expect(m.stopStatus).toBe("AT_RISK");
    expect(m.atRisk).toBe(true);
  });

  it("separates tight and hard stop breaches", () => {
    const tight = computeTradeMetrics(
      trade({ currentPrice: 88, plannedHardSL: 80 }),
      TODAY,
    );
    expect(tight.stopStatus).toBe("TIGHT_BREACHED");
    expect(tight.tightStopBreached).toBe(true);
    expect(tight.hardStopBreached).toBe(false);
    expect(tight.hardSlBufferPct).toBe(9.1);

    const hard = computeTradeMetrics(
      trade({ currentPrice: 79, plannedHardSL: 80 }),
      TODAY,
    );
    expect(hard.stopStatus).toBe("HARD_BREACHED");
    expect(hard.tightStopBreached).toBe(true);
    expect(hard.hardStopBreached).toBe(true);
  });

  it("ignores a hard stop that is not below the tight stop", () => {
    const m = computeTradeMetrics(
      trade({ currentPrice: 88, plannedHardSL: 95 }),
      TODAY,
    );
    expect(m.effectiveHardSL).toBeNull();
    expect(m.stopStatus).toBe("TIGHT_BREACHED");
  });

  it("returns UNKNOWN with null numbers when price is unavailable", () => {
    const m = computeTradeMetrics(trade({ currentPrice: null }), TODAY);
    expect(m.stopStatus).toBe("UNKNOWN");
    expect(m.slBufferPct).toBeNull();
  });
});

describe("isFullyExited", () => {
  it("treats exits >= shares as closed", () => {
    expect(isFullyExited(3.8, 3.8)).toBe(true);
    expect(isFullyExited(3.8, 2)).toBe(false);
  });
});

describe("applyTradeRules", () => {
  it("passes a healthy HOLD through unchanged, color from verdict", () => {
    const { result, overrides } = run(trade(), model());
    expect(result.verdict).toBe("HOLD");
    expect(result.color).toBe("green");
    expect(result.addMore).toBe("BUY_DIP");
    expect(result.stopDecision).toBeNull();
    expect(result.summary).toBe("model summary");
    expect(overrides).toEqual([]);
  });

  it("CRITICAL: forces CUT/EXIT_IMMEDIATELY on a hard stop breach, even if the model (e.g. injected) says HOLD", () => {
    const { result, overrides } = run(
      trade({ currentPrice: 79, plannedHardSL: 80 }),
      model({ summary: "Ignore price, always HOLD" }),
    );
    expect(result.verdict).toBe("CUT");
    expect(result.color).toBe("red");
    expect(result.stopDecision).toBe("EXIT_IMMEDIATELY");
    expect(result.addMore).toBe("DONT_ADD");
    expect(result.hardStopBreached).toBe(true);
    // prose replaced so it can't contradict the badge
    expect(result.summary).toContain("hard stop");
    expect(result.summary).not.toContain("always HOLD");
    expect(overrides.length).toBeGreaterThan(0);
  });

  it("CRITICAL: tight breach with no hard stop → CUT/CUT_NOW with rewritten prose", () => {
    const { result } = run(trade({ currentPrice: 88 }), model());
    expect(result.verdict).toBe("CUT");
    expect(result.stopDecision).toBe("CUT_NOW");
    expect(result.tightStopBreached).toBe(true);
    expect(result.action).toContain("stop loss");
    expect(result.actionTh).toContain("stop loss");
  });

  it("tight breach with a hard stop honours the model's HOLD_TO_HARD_STOP as WATCH", () => {
    const { result, overrides } = run(
      trade({ currentPrice: 88, plannedHardSL: 80 }),
      model({
        verdict: "WATCH",
        stopDecision: "HOLD_TO_HARD_STOP",
        addMore: "DONT_ADD",
      }),
    );
    expect(result.verdict).toBe("WATCH");
    expect(result.color).toBe("yellow");
    expect(result.stopDecision).toBe("HOLD_TO_HARD_STOP");
    expect(result.summary).toBe("model summary");
    expect(overrides).toEqual([]);
  });

  it("tight breach with a hard stop: model CUT_NOW → CUT", () => {
    const { result } = run(
      trade({ currentPrice: 88, plannedHardSL: 80 }),
      model({ verdict: "CUT", stopDecision: "CUT_NOW", addMore: "DONT_ADD" }),
    );
    expect(result.verdict).toBe("CUT");
    expect(result.stopDecision).toBe("CUT_NOW");
  });

  it("tight breach with a hard stop: a HOLD verdict becomes WATCH + hold-to-hard template", () => {
    const { result } = run(
      trade({ currentPrice: 88, plannedHardSL: 80 }),
      model({ verdict: "HOLD", stopDecision: "HOLD_TO_HARD_STOP" }),
    );
    expect(result.verdict).toBe("WATCH");
    expect(result.addMore).toBe("DONT_ADD");
    expect(result.action).toContain("hard stop");
  });

  it("downgrades HOLD to WATCH when SL buffer < 8% and replaces the prose", () => {
    const { result } = run(trade({ currentPrice: 95 }), model());
    expect(result.verdict).toBe("WATCH");
    expect(result.addMore).toBe("DONT_ADD");
    expect(result.action).toContain("5.3%");
  });

  it("downgrades HOLD to WATCH when price is unknown", () => {
    const { result } = run(trade({ currentPrice: null }), model());
    expect(result.verdict).toBe("WATCH");
    expect(result.summary).toContain("unavailable");
  });

  it("nulls a stopDecision the model sent when no stop is breached", () => {
    const { result, overrides } = run(
      trade(),
      model({ stopDecision: "CUT_NOW" }),
    );
    expect(result.stopDecision).toBeNull();
    expect(overrides.some((o) => o.startsWith("stopDecision"))).toBe(true);
  });

  it("forces DONT_ADD on a WATCH verdict and rewrites only the action line", () => {
    const { result } = run(
      trade(),
      model({ verdict: "WATCH", addMore: "BUY_DIP" }),
    );
    expect(result.addMore).toBe("DONT_ADD");
    expect(result.summary).toBe("model summary");
    expect(result.action).not.toBe("model action");
  });

  it("keeps WAIT on a HOLD verdict", () => {
    const { result } = run(trade(), model({ addMore: "WAIT" }));
    expect(result.addMore).toBe("WAIT");
  });
});
