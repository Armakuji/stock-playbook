import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { TradesService } from "./trades.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    trade: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tradeExit: { create: jest.fn(), findMany: jest.fn() },
  } as unknown as PrismaService;
}

function makeLoggerMock() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
}

const OWNER = "user-1";
const OTHER = "user-2";

describe("TradesService", () => {
  it("findOne throws NotFoundException when the trade belongs to a different user", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: OTHER,
    });
    const service = new TradesService(prisma, makeLoggerMock());

    await expect(service.findOne("t1", OWNER)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("findOne throws NotFoundException when the trade doesn't exist", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(null);
    const service = new TradesService(prisma, makeLoggerMock());

    await expect(service.findOne("missing", OWNER)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("addExit closes the trade and computes realizedPnL once all shares are exited", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 2, entryPrice: 100 };
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    // no prior exits — this single 2-share exit fully closes the 2-share trade
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.trade.update as jest.Mock).mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...trade,
        ...data,
      }),
    );

    const service = new TradesService(prisma, makeLoggerMock());
    const updated = await service.addExit("t1", OWNER, {
      date: "2026-07-01",
      price: 120,
      shares: 2,
    });

    expect(updated.status).toBe("closed");
    expect(updated.realizedPnL).toBe(40); // 2 * (120 - 100)
  });

  it("addExit sums prior exits plus the new one, not just the new exit alone", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 5, entryPrice: 100 };
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    // 2 prior exits (3 shares total) + the new 2-share exit = 5 shares = fully closed
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([
      { shares: 2, price: 110 },
      { shares: 1, price: 115 },
    ]);
    (prisma.trade.update as jest.Mock).mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...trade,
        ...data,
      }),
    );

    const service = new TradesService(prisma, makeLoggerMock());
    const updated = await service.addExit("t1", OWNER, {
      date: "2026-07-01",
      price: 120,
      shares: 2,
    });

    expect(updated.status).toBe("closed");
    // realizedPnL = 2*(110-100) + 1*(115-100) + 2*(120-100) = 20 + 15 + 40 = 75
    expect(updated.realizedPnL).toBe(75);
  });

  it("addExit leaves the trade open when shares remain", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 5, entryPrice: 100 };
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    // no prior exits — this single 2-share exit leaves 3 shares open on a 5-share trade
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.trade.update as jest.Mock).mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...trade,
        ...data,
      }),
    );

    const service = new TradesService(prisma, makeLoggerMock());
    const updated = await service.addExit("t1", OWNER, {
      date: "2026-07-01",
      price: 120,
      shares: 2,
    });

    expect(updated.status).toBeUndefined(); // no status/realizedPnL update applied
  });

  it("addExit rejects an over-exit beyond remaining shares with 400, no tradeExit row created", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 5, entryPrice: 100 };
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(trade);
    // 4 shares already exited — only 1 remains
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([
      { shares: 4, price: 110 },
    ]);

    const service = new TradesService(prisma, makeLoggerMock());

    await expect(
      service.addExit("t1", OWNER, {
        date: "2026-07-01",
        price: 120,
        shares: 2,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.tradeExit.create).not.toHaveBeenCalled();
    expect(prisma.trade.update).not.toHaveBeenCalled();
  });

  it("addExit allows exiting exactly the remaining shares (closes trade, realizedPnL computed)", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 5, entryPrice: 100 };
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    // 3 shares already exited — exiting the remaining 2 should be allowed exactly
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([
      { shares: 3, price: 110 },
    ]);
    (prisma.trade.update as jest.Mock).mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        ...trade,
        ...data,
      }),
    );

    const service = new TradesService(prisma, makeLoggerMock());
    const updated = await service.addExit("t1", OWNER, {
      date: "2026-07-01",
      price: 120,
      shares: 2,
    });

    expect(updated.status).toBe("closed");
    // realizedPnL = 3*(110-100) + 2*(120-100) = 30 + 40 = 70
    expect(updated.realizedPnL).toBe(70);
  });

  it("update rejects a trade owned by a different user", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: OTHER,
    });
    const service = new TradesService(prisma, makeLoggerMock());

    await expect(
      service.update("t1", OWNER, { notes: "hijack attempt" }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.trade.update).not.toHaveBeenCalled();
  });

  it("logs 'trade created' with userId, tradeId, and ticker (no other fields)", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.create as jest.Mock).mockResolvedValue({
      id: "t1",
      ticker: "NVDA",
      entryPrice: 131.38,
      notes: "thesis notes",
    });
    const logger = makeLoggerMock();
    const service = new TradesService(prisma, logger);

    await service.create(OWNER, {
      ticker: "nvda",
      catalystType: "earnings_beat",
      entryPrice: 131.38,
      shares: 10,
      entryDate: "2026-07-01",
      plannedTP: [150, 165, 185],
      plannedSL: 118,
      notes: "thesis notes",
    });

    expect(logger.info).toHaveBeenCalledWith(
      { userId: OWNER, tradeId: "t1", ticker: "NVDA" },
      "trade created",
    );
  });

  it("create throws ConflictException when the chosen id collides (Prisma P2002)", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );
    const service = new TradesService(prisma, makeLoggerMock());

    await expect(
      service.create(OWNER, {
        id: "dup-id",
        ticker: "nvda",
        catalystType: "earnings_beat",
        entryPrice: 131.38,
        shares: 10,
        entryDate: "2026-07-01",
        plannedTP: [150, 165, 185],
        plannedSL: 118,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("create rethrows non-P2002 Prisma errors unchanged", async () => {
    const prisma = makePrismaMock();
    const otherError = new Prisma.PrismaClientKnownRequestError(
      "Some other error",
      {
        code: "P2025",
        clientVersion: "6.0.0",
      },
    );
    (prisma.trade.create as jest.Mock).mockRejectedValue(otherError);
    const service = new TradesService(prisma, makeLoggerMock());

    await expect(
      service.create(OWNER, {
        ticker: "nvda",
        catalystType: "earnings_beat",
        entryPrice: 131.38,
        shares: 10,
        entryDate: "2026-07-01",
        plannedTP: [150, 165, 185],
        plannedSL: 118,
      }),
    ).rejects.toBe(otherError);
  });

  it("logs 'trade updated' with userId, tradeId, and ticker", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: OWNER,
    });
    (prisma.trade.update as jest.Mock).mockResolvedValue({
      id: "t1",
      ticker: "AVGO",
      notes: "updated notes",
    });
    const logger = makeLoggerMock();
    const service = new TradesService(prisma, logger);

    await service.update("t1", OWNER, { notes: "updated notes" });

    expect(logger.info).toHaveBeenCalledWith(
      { userId: OWNER, tradeId: "t1", ticker: "AVGO" },
      "trade updated",
    );
  });

  it("logs 'trade deleted' with userId, tradeId, and ticker", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: OWNER,
      ticker: "MU",
    });
    (prisma.trade.update as jest.Mock).mockResolvedValue({});
    const logger = makeLoggerMock();
    const service = new TradesService(prisma, logger);

    await service.remove("t1", OWNER);

    expect(logger.info).toHaveBeenCalledWith(
      { userId: OWNER, tradeId: "t1", ticker: "MU" },
      "trade deleted",
    );
  });

  it("remove soft-deletes via update({ deletedAt }) instead of a hard delete", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: OWNER,
      ticker: "MU",
    });
    (prisma.trade.update as jest.Mock).mockResolvedValue({});
    const service = new TradesService(prisma, makeLoggerMock());

    await service.remove("t1", OWNER);

    expect(prisma.trade.delete).not.toHaveBeenCalled();
    expect(prisma.trade.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { deletedAt: expect.any(Date) as Date },
    });
  });

  it("findAll filters out soft-deleted trades (deletedAt: null)", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);
    const service = new TradesService(prisma, makeLoggerMock());

    await service.findAll(OWNER);

    expect(prisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: OWNER, deletedAt: null },
      }),
    );
  });

  it("findOne filters out soft-deleted trades and 404s when found trade is deleted", async () => {
    const prisma = makePrismaMock();
    // A soft-deleted trade must not be returned by the (mocked) query in the
    // first place — activeTradeWhere() ensures the DB-level filter excludes it.
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(null);
    const service = new TradesService(prisma, makeLoggerMock());

    await expect(service.findOne("t1", OWNER)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.trade.findFirst).toHaveBeenCalledWith({
      where: { id: "t1", deletedAt: null },
    });
  });

  it("removing an already-deleted trade 404s instead of soft-deleting again", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findFirst as jest.Mock).mockResolvedValue(null);
    const service = new TradesService(prisma, makeLoggerMock());

    await expect(service.remove("t1", OWNER)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.trade.update).not.toHaveBeenCalled();
  });
});
