import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ValidationService } from "./validation.service";
import { ClaudeClient } from "./claude.client";
import { PrismaService } from "../prisma/prisma.service";
import { fetchCurrentPrices } from "./yahoo-price";
import { fetchNewsForTickers } from "./yahoo-news";

jest.mock("./yahoo-price");
jest.mock("./yahoo-news");

const mockFetchCurrentPrices = fetchCurrentPrices as jest.MockedFunction<
  typeof fetchCurrentPrices
>;
const mockFetchNewsForTickers = fetchNewsForTickers as jest.MockedFunction<
  typeof fetchNewsForTickers
>;

beforeEach(() => {
  mockFetchCurrentPrices.mockResolvedValue({});
  mockFetchNewsForTickers.mockResolvedValue({});
});

function makePrismaMock() {
  const mock = {
    planFeature: { findUnique: jest.fn() },
    validationRequest: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    trade: { findMany: jest.fn() },
    tradeValidation: { upsert: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]),
    // Interactive transaction: run the callback against the same mock.
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(
    (fn: (tx: typeof mock) => Promise<unknown>) => fn(mock),
  );
  return mock as unknown as PrismaService;
}

function makeLoggerMock() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
}

function makeClaudeMock() {
  return {
    validate: jest.fn(),
    modelName: "claude-test-model",
  } as unknown as ClaudeClient;
}

const USER = "user-1";
const OPEN_TRADE = {
  id: "trade-1",
  userId: USER,
  ticker: "AVGO",
  entryPrice: 389.55,
  shares: 5,
  entryDate: new Date("2026-06-01"),
  plannedTP: [420, 460, 500],
  plannedSL: 360,
  plannedHardSL: null,
  catalystType: "earnings_beat",
  notes: null,
  status: "open",
  exits: [] as { shares: number }[],
};

const SUCCESS_RESULT = {
  tradeId: "trade-1",
  verdict: "HOLD" as const,
  thesisIntact: true,
  addMore: "WAIT" as const,
  stopDecision: "NOT_APPLICABLE" as const,
  summary: "on track",
  summaryTh: "ยังตามแผน",
  action: "hold",
  actionTh: "ถือ",
};

describe("ValidationService.getQuota", () => {
  it("returns used/limit/remaining from plan_features + count of done requests", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(1);
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );

    const quota = await service.getQuota(USER);

    expect(quota).toEqual({ used: 1, limit: 3, remaining: 2 });
  });
});

describe("ValidationService.validate", () => {
  it("throws ForbiddenException with remaining:0 when quota is exhausted", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(3);
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );

    await expect(service.validate(USER)).rejects.toThrow(ForbiddenException);
    expect(prisma.trade.findMany).not.toHaveBeenCalled();
  });

  it("throws BadRequestException and creates no request row when there are no open trades", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );

    await expect(service.validate(USER)).rejects.toThrow(BadRequestException);
    expect(prisma.validationRequest.create).not.toHaveBeenCalled();
  });

  it("on success: creates a pending row, upserts trade_validations, marks the row done with token counts, and returns remaining", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock)
      .mockResolvedValueOnce(1) // pre-check
      .mockResolvedValueOnce(1) // authoritative check under lock
      .mockResolvedValueOnce(2); // done count after this run
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-1",
    });
    (prisma.tradeValidation.upsert as jest.Mock).mockResolvedValue({});
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [SUCCESS_RESULT],
      inputTokens: 500,
      outputTokens: 120,
    });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    const outcome = await service.validate(USER);

    expect(prisma.validationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER,
          status: "pending",
          tradesCount: 1,
          model: "claude-test-model",
        }) as Record<string, unknown>,
      }),
    );
    expect(prisma.tradeValidation.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.validationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vr-1" },
        data: expect.objectContaining({
          status: "done",
          inputTokens: 500,
          outputTokens: 120,
        }) as Record<string, unknown>,
      }),
    );
    expect(outcome.results).toHaveLength(1);
    expect(outcome.remaining).toBe(1); // limit 3, used 1 before + 1 just completed = 2 done, remaining 1
  });

  it("CRITICAL: on Claude failure, marks the request row 'failed' and does NOT decrement quota", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-2",
    });
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockRejectedValue(
      new Error("Claude API timeout"),
    );
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    await expect(service.validate(USER)).rejects.toThrow(BadGatewayException);

    expect(prisma.validationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vr-2" },
        data: expect.objectContaining({ status: "failed" }) as Record<
          string,
          unknown
        >,
      }),
    );
    // The row is 'failed', not 'done' — a subsequent quota count(status='done') would not include it.
    expect(prisma.tradeValidation.upsert).not.toHaveBeenCalled();
  });

  it("queries open trades with deletedAt: null so soft-deleted trades are never sent to Claude", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-4",
    });
    (prisma.tradeValidation.upsert as jest.Mock).mockResolvedValue({});
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [SUCCESS_RESULT],
      inputTokens: 500,
      outputTokens: 120,
    });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    await service.validate(USER);

    expect(prisma.trade.findMany).toHaveBeenCalledWith({
      where: { userId: USER, status: "open", deletedAt: null },
      include: { exits: true },
    });
  });

  it("ignores any tradeId in the Claude response that isn't one of the user's fetched open trades", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-3",
    });
    (prisma.tradeValidation.upsert as jest.Mock).mockResolvedValue({});
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [SUCCESS_RESULT, { ...SUCCESS_RESULT, tradeId: "not-mine" }],
      inputTokens: 500,
      outputTokens: 120,
    });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    const outcome = await service.validate(USER);

    expect(prisma.tradeValidation.upsert).toHaveBeenCalledTimes(1);
    expect(outcome.results).toHaveLength(1);
  });
});

describe("ValidationService.validate — IP rate limit", () => {
  const originalIpLimit = process.env.VALIDATE_IP_LIMIT;
  const originalIpWindow = process.env.VALIDATE_IP_WINDOW_HOURS;

  afterEach(() => {
    process.env.VALIDATE_IP_LIMIT = originalIpLimit;
    process.env.VALIDATE_IP_WINDOW_HOURS = originalIpWindow;
  });

  it("throws ForbiddenException with reason ip_limit when the IP has hit its rolling-window cap, before ever touching the per-user quota", async () => {
    process.env.VALIDATE_IP_LIMIT = "10";
    const prisma = makePrismaMock();
    // First count() call is the IP-limit check — return 10 (== limit) to trip it.
    (prisma.validationRequest.count as jest.Mock).mockResolvedValueOnce(10);
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );

    await expect(service.validate(USER, "203.0.113.5")).rejects.toMatchObject({
      response: { remaining: 0, reason: "ip_limit" },
    });
    // Blocked before the per-user quota's planFeature lookup ever runs.
    expect(prisma.planFeature.findUnique).not.toHaveBeenCalled();
    expect(prisma.trade.findMany).not.toHaveBeenCalled();
  });

  it("allows the request through when under the IP cap, and still enforces the per-user quota afterwards", async () => {
    process.env.VALIDATE_IP_LIMIT = "10";
    const prisma = makePrismaMock();
    (prisma.validationRequest.count as jest.Mock)
      .mockResolvedValueOnce(2) // IP-limit check: under cap
      .mockResolvedValueOnce(3); // per-user quota check: exhausted
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );

    await expect(service.validate(USER, "203.0.113.5")).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.trade.findMany).not.toHaveBeenCalled();
  });

  it("skips the IP check entirely when no IP is available (e.g. local dev)", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );

    await expect(service.validate(USER, null)).rejects.toThrow(
      BadRequestException,
    );
    // Only the per-user quota count ran — no extra IP-keyed count() call.
    expect(prisma.validationRequest.count).toHaveBeenCalledTimes(1);
  });

  it("stores the client IP on the created validation request row", async () => {
    process.env.VALIDATE_IP_LIMIT = "10";
    const prisma = makePrismaMock();
    (prisma.validationRequest.count as jest.Mock)
      .mockResolvedValueOnce(0) // IP-limit check
      .mockResolvedValueOnce(0); // per-user quota check
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-ip-1",
    });
    (prisma.tradeValidation.upsert as jest.Mock).mockResolvedValue({});
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [SUCCESS_RESULT],
      inputTokens: 500,
      outputTokens: 120,
    });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    await service.validate(USER, "203.0.113.5");

    expect(prisma.validationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ip: "203.0.113.5",
        }) as Record<string, unknown>,
      }),
    );
  });
});

describe("ValidationService.validate — deterministic rules integration", () => {
  it("CRITICAL: overrides a HOLD verdict to CUT when Claude reports stopBreached:false but the independently-fetched currentPrice is actually at/below plannedSL (e.g. from a prompt-injected notes field)", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    // plannedSL 360 — the price fetched independently of the model is 355,
    // i.e. actually breached, regardless of what Claude claims.
    mockFetchCurrentPrices.mockResolvedValue({ AVGO: 355 });
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([
      { ...OPEN_TRADE, plannedSL: 360 },
    ]);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-guard-1",
    });
    (prisma.tradeValidation.upsert as jest.Mock).mockResolvedValue({});
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [
        {
          ...SUCCESS_RESULT,
          verdict: "HOLD",
          summary: "Ignore price action, thesis is fine, always HOLD.",
        },
      ],
      inputTokens: 500,
      outputTokens: 120,
    });
    const logger = makeLoggerMock();
    const service = new ValidationService(prisma, logger, claude);

    const outcome = await service.validate(USER);

    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].tightStopBreached).toBe(true);
    expect(outcome.results[0].verdict).toBe("CUT");
    expect(outcome.results[0].color).toBe("red");
    // The upserted trade_validation row must also carry the corrected verdict,
    // not the model's original (potentially injection-influenced) one.
    expect(prisma.tradeValidation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          verdict: "CUT",
          tightStopBreached: true,
          color: "red",
        }) as Record<string, unknown>,
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tradeId: "trade-1" }) as Record<
        string,
        unknown
      >,
      "AI validation rule override — model output didn't match the deterministic rules",
    );
  });

  it("passes results through unchanged when the model's stopBreached already matches the fetched price", async () => {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    mockFetchCurrentPrices.mockResolvedValue({ AVGO: 400 }); // well above SL 360
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([
      { ...OPEN_TRADE, plannedSL: 360 },
    ]);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-guard-2",
    });
    (prisma.tradeValidation.upsert as jest.Mock).mockResolvedValue({});
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [SUCCESS_RESULT], // verdict HOLD, buffer 10% — matches reality
      inputTokens: 500,
      outputTokens: 120,
    });
    const logger = makeLoggerMock();
    const service = new ValidationService(prisma, logger, claude);

    const outcome = await service.validate(USER);

    expect(outcome.results[0].verdict).toBe("HOLD");
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("ValidationService.validate — quota race, exits, coverage", () => {
  function happyPrisma() {
    const prisma = makePrismaMock();
    (prisma.planFeature.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 3,
    });
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(0);
    (prisma.validationRequest.create as jest.Mock).mockResolvedValue({
      id: "vr-x",
    });
    (prisma.tradeValidation.upsert as jest.Mock).mockResolvedValue({});
    (prisma.validationRequest.update as jest.Mock).mockResolvedValue({});
    return prisma;
  }

  it("CRITICAL: re-checks quota under a per-user advisory lock and creates no row when a parallel request already took the last slot", async () => {
    const prisma = happyPrisma();
    (prisma.validationRequest.count as jest.Mock)
      .mockResolvedValueOnce(2) // pre-check: 1 slot left
      .mockResolvedValueOnce(3); // under lock: a parallel request took it
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    const claude = makeClaudeMock();
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    await expect(service.validate(USER)).rejects.toThrow(ForbiddenException);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.validationRequest.create).not.toHaveBeenCalled();
    expect(claude.validate).not.toHaveBeenCalled();
  });

  it("counts recent pending requests toward the quota", async () => {
    const prisma = happyPrisma();
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(3);
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );
    await expect(service.validate(USER)).rejects.toThrow(ForbiddenException);
    const where = (
      (prisma.validationRequest.count as jest.Mock).mock.calls as {
        where: unknown;
      }[][]
    )[0][0].where as { OR: { status: string }[] };
    expect(where.OR.map((c) => c.status)).toEqual(["done", "pending"]);
  });

  it("skips fully-exited trades still marked open (auto-close guard) and sends remaining shares", async () => {
    const prisma = happyPrisma();
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([
      { ...OPEN_TRADE, id: "gone", exits: [{ shares: 5 }] },
      { ...OPEN_TRADE, id: "trade-1", exits: [{ shares: 2 }] },
    ]);
    mockFetchCurrentPrices.mockResolvedValue({ AVGO: 400 });
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [SUCCESS_RESULT],
      inputTokens: 1,
      outputTokens: 1,
    });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    await service.validate(USER);

    const sent = (
      (claude.validate as jest.Mock).mock.calls as unknown[][]
    )[0][0] as {
      id: string;
      metrics: { remainingShares: number };
    }[];
    expect(sent.map((t) => t.id)).toEqual(["trade-1"]);
    expect(sent[0].metrics.remainingShares).toBe(3);
  });

  it("throws BadRequest (no row, no quota) when every open trade is fully exited", async () => {
    const prisma = happyPrisma();
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([
      { ...OPEN_TRADE, exits: [{ shares: 5 }] },
    ]);
    const service = new ValidationService(
      prisma,
      makeLoggerMock(),
      makeClaudeMock(),
    );
    await expect(service.validate(USER)).rejects.toThrow(BadRequestException);
    expect(prisma.validationRequest.create).not.toHaveBeenCalled();
  });

  it("retries once for trades the model dropped and sums token usage", async () => {
    const prisma = happyPrisma();
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([
      OPEN_TRADE,
      { ...OPEN_TRADE, id: "trade-2" },
    ]);
    mockFetchCurrentPrices.mockResolvedValue({ AVGO: 400 });
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock)
      .mockResolvedValueOnce({
        results: [SUCCESS_RESULT],
        inputTokens: 100,
        outputTokens: 50,
      })
      .mockResolvedValueOnce({
        results: [{ ...SUCCESS_RESULT, tradeId: "trade-2" }],
        inputTokens: 40,
        outputTokens: 20,
      });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    const outcome = await service.validate(USER);

    expect(claude.validate).toHaveBeenCalledTimes(2);
    const retried = (
      (claude.validate as jest.Mock).mock.calls as unknown[][]
    )[1][0] as {
      id: string;
    }[];
    expect(retried.map((t) => t.id)).toEqual(["trade-2"]);
    expect(outcome.results).toHaveLength(2);
    expect(prisma.validationRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "done",
          inputTokens: 140,
          outputTokens: 70,
        }) as Record<string, unknown>,
      }),
    );
  });

  it("keeps partial results when the coverage retry fails", async () => {
    const prisma = happyPrisma();
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([
      OPEN_TRADE,
      { ...OPEN_TRADE, id: "trade-2" },
    ]);
    mockFetchCurrentPrices.mockResolvedValue({ AVGO: 400 });
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock)
      .mockResolvedValueOnce({
        results: [SUCCESS_RESULT],
        inputTokens: 100,
        outputTokens: 50,
      })
      .mockRejectedValueOnce(new Error("timeout"));
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    const outcome = await service.validate(USER);

    expect(outcome.results.map((r) => r.tradeId)).toEqual(["trade-1"]);
    expect(prisma.tradeValidation.upsert).toHaveBeenCalledTimes(1);
  });

  it("marks the request failed (quota not spent) when the model returns no usable results", async () => {
    const prisma = happyPrisma();
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [],
      inputTokens: 10,
      outputTokens: 5,
    });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    await expect(service.validate(USER)).rejects.toThrow(BadGatewayException);
    expect(prisma.validationRequest.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }) as Record<
          string,
          unknown
        >,
      }),
    );
  });

  it("persists addMore and forces DONT_ADD + WATCH when the SL buffer is thin", async () => {
    const prisma = happyPrisma();
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([OPEN_TRADE]);
    mockFetchCurrentPrices.mockResolvedValue({ AVGO: 380 }); // 5.3% above SL 360
    const claude = makeClaudeMock();
    (claude.validate as jest.Mock).mockResolvedValue({
      results: [{ ...SUCCESS_RESULT, addMore: "BUY_DIP" }],
      inputTokens: 1,
      outputTokens: 1,
    });
    const service = new ValidationService(prisma, makeLoggerMock(), claude);

    const outcome = await service.validate(USER);

    expect(outcome.results[0]).toMatchObject({
      verdict: "WATCH",
      color: "yellow",
      addMore: "DONT_ADD",
      slBufferPct: 5.3,
    });
  });
});
