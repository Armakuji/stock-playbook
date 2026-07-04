import { NotFoundException } from "@nestjs/common";
import { TradesService } from "./trades.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    trade: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    tradeExit: { create: jest.fn(), findMany: jest.fn() },
  } as unknown as PrismaService;
}

const OWNER = "user-1";
const OTHER = "user-2";

describe("TradesService", () => {
  it("findOne throws NotFoundException when the trade belongs to a different user", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue({ id: "t1", userId: OTHER });
    const service = new TradesService(prisma);

    await expect(service.findOne("t1", OWNER)).rejects.toThrow(NotFoundException);
  });

  it("findOne throws NotFoundException when the trade doesn't exist", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue(null);
    const service = new TradesService(prisma);

    await expect(service.findOne("missing", OWNER)).rejects.toThrow(NotFoundException);
  });

  it("addExit closes the trade and computes realizedPnL once all shares are exited", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 2, entryPrice: 100 };
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([{ shares: 2, price: 120 }]);
    (prisma.trade.update as jest.Mock).mockImplementation(({ data }) => ({ ...trade, ...data }));

    const service = new TradesService(prisma);
    const updated = await service.addExit("t1", OWNER, { date: "2026-07-01", price: 120, shares: 2 });

    expect(updated.status).toBe("closed");
    expect(updated.realizedPnL).toBe(40); // 2 * (120 - 100)
  });

  it("addExit sums prior exits plus the new one, not just the new exit alone", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 5, entryPrice: 100 };
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    // 2 prior exits (3 shares total) + the new 2-share exit = 5 shares = fully closed
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([
      { shares: 2, price: 110 },
      { shares: 1, price: 115 },
      { shares: 2, price: 120 },
    ]);
    (prisma.trade.update as jest.Mock).mockImplementation(({ data }) => ({ ...trade, ...data }));

    const service = new TradesService(prisma);
    const updated = await service.addExit("t1", OWNER, { date: "2026-07-01", price: 120, shares: 2 });

    expect(updated.status).toBe("closed");
    // realizedPnL = 2*(110-100) + 1*(115-100) + 2*(120-100) = 20 + 15 + 40 = 75
    expect(updated.realizedPnL).toBe(75);
  });

  it("addExit leaves the trade open when shares remain", async () => {
    const prisma = makePrismaMock();
    const trade = { id: "t1", userId: OWNER, shares: 5, entryPrice: 100 };
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue(trade);
    (prisma.tradeExit.create as jest.Mock).mockResolvedValue({});
    (prisma.tradeExit.findMany as jest.Mock).mockResolvedValue([{ shares: 2, price: 120 }]);
    (prisma.trade.update as jest.Mock).mockImplementation(({ data }) => ({ ...trade, ...data }));

    const service = new TradesService(prisma);
    const updated = await service.addExit("t1", OWNER, { date: "2026-07-01", price: 120, shares: 2 });

    expect(updated.status).toBeUndefined(); // no status/realizedPnL update applied
  });

  it("update rejects a trade owned by a different user", async () => {
    const prisma = makePrismaMock();
    (prisma.trade.findUnique as jest.Mock).mockResolvedValue({ id: "t1", userId: OTHER });
    const service = new TradesService(prisma);

    await expect(service.update("t1", OWNER, { notes: "hijack attempt" })).rejects.toThrow(NotFoundException);
    expect(prisma.trade.update).not.toHaveBeenCalled();
  });
});
