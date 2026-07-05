import { Injectable, NotFoundException } from "@nestjs/common";
import { Trade } from "@prisma/client";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTradeDto } from "./dto/create-trade.dto";
import { UpdateTradeDto } from "./dto/update-trade.dto";
import { CreateExitDto } from "./dto/create-exit.dto";

@Injectable()
export class TradesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(TradesService.name) private readonly logger: PinoLogger,
  ) {}

  findAll(userId: string) {
    return this.prisma.trade.findMany({
      where: { userId },
      include: { exits: true },
      orderBy: { entryDate: "desc" },
    });
  }

  async findOne(id: string, userId: string): Promise<Trade> {
    const trade = await this.prisma.trade.findUnique({ where: { id } });
    if (!trade || trade.userId !== userId) throw new NotFoundException("Trade not found");
    return trade;
  }

  async create(userId: string, dto: CreateTradeDto) {
    const trade = await this.prisma.trade.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        userId,
        ticker: dto.ticker.toUpperCase(),
        catalystType: dto.catalystType,
        linkedReportDate: dto.linkedReportDate,
        entryPrice: dto.entryPrice,
        shares: dto.shares,
        entryDate: new Date(dto.entryDate),
        plannedTP: dto.plannedTP,
        plannedSL: dto.plannedSL,
        status: "open",
        notes: dto.notes,
      },
      include: { exits: true },
    });
    this.logger.info({ userId, tradeId: trade.id, ticker: trade.ticker }, "trade created");
    return trade;
  }

  async update(id: string, userId: string, dto: UpdateTradeDto) {
    await this.findOne(id, userId);
    const trade = await this.prisma.trade.update({
      where: { id },
      data: {
        ...(dto.ticker !== undefined && { ticker: dto.ticker.toUpperCase() }),
        ...(dto.catalystType !== undefined && { catalystType: dto.catalystType }),
        ...(dto.linkedReportDate !== undefined && { linkedReportDate: dto.linkedReportDate }),
        ...(dto.entryPrice !== undefined && { entryPrice: dto.entryPrice }),
        ...(dto.shares !== undefined && { shares: dto.shares }),
        ...(dto.entryDate !== undefined && { entryDate: new Date(dto.entryDate) }),
        ...(dto.plannedTP !== undefined && { plannedTP: dto.plannedTP }),
        ...(dto.plannedSL !== undefined && { plannedSL: dto.plannedSL }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { exits: true },
    });
    this.logger.info({ userId, tradeId: id, ticker: trade.ticker }, "trade updated");
    return trade;
  }

  async remove(id: string, userId: string): Promise<void> {
    const trade = await this.findOne(id, userId);
    await this.prisma.trade.delete({ where: { id } });
    this.logger.info({ userId, tradeId: id, ticker: trade.ticker }, "trade deleted");
  }

  async addExit(id: string, userId: string, dto: CreateExitDto) {
    const trade = await this.findOne(id, userId);
    await this.prisma.tradeExit.create({
      data: { tradeId: id, date: new Date(dto.date), price: dto.price, shares: dto.shares, note: dto.note },
    });

    const exits = await this.prisma.tradeExit.findMany({ where: { tradeId: id } });
    const exitedShares = exits.reduce((sum, e) => sum + e.shares, 0);

    const data: { status?: string; realizedPnL?: number } = {};
    if (exitedShares >= trade.shares) {
      data.status = "closed";
      data.realizedPnL = exits.reduce((sum, e) => sum + e.shares * (e.price - trade.entryPrice), 0);
    }

    return this.prisma.trade.update({ where: { id }, data, include: { exits: true } });
  }
}
