import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ValidationService } from "./validation.service";
import { ClaudeClient } from "./claude.client";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    planFeature: { findUnique: jest.fn() },
    validationRequest: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    trade: { findMany: jest.fn() },
    tradeValidation: { upsert: jest.fn() },
  } as unknown as PrismaService;
}

function makeLoggerMock() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
}

function makeClaudeMock() {
  return { validate: jest.fn() } as unknown as ClaudeClient;
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
  notes: null,
  status: "open",
};

const SUCCESS_RESULT = {
  tradeId: "trade-1",
  verdict: "HOLD" as const,
  thesisIntact: true,
  stopBreached: false,
  atRisk: false,
  summary: "on track",
  action: "hold",
  color: "green" as const,
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
    (prisma.validationRequest.count as jest.Mock).mockResolvedValue(1);
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
