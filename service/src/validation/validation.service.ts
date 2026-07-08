import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PrismaService } from "../prisma/prisma.service";
import { ClaudeClient } from "./claude.client";
import { TradeForPrompt, ValidationToolResult } from "./prompt";
import { toTradeValidationWrite } from "./validation.mapper";
import { fetchCurrentPrices } from "./yahoo-price";
import { fetchNewsForTickers } from "./yahoo-news";
import { applyStopGuard } from "./stop-guard";
import { activeTradeWhere } from "../trades/trade-filters";

const FREE_PLAN_ID = "free";
const AI_VALIDATION_FEATURE_ID = "ai_validation";

// IP-based rate limit — a safety net on top of the per-user quota. The
// per-user quota alone doesn't stop someone from creating N throwaway Google
// accounts on the same network to farm N × 3 free AI calls; this caps total
// calls from one IP within a rolling window regardless of which account made
// them. Configurable via env since "one IP" can mean a shared office/mobile
// network — keep it loose enough to not false-positive on legitimate shared
// connections while still blocking obvious account-cycling abuse.
const DEFAULT_IP_LIMIT = 10;
const DEFAULT_IP_WINDOW_HOURS = 24;

export type TradeValidationDto = ValidationToolResult & { validatedAt: string };

export interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
}

@Injectable()
export class ValidationService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(ValidationService.name)
    private readonly logger: PinoLogger,
    private readonly claude: ClaudeClient,
  ) {}

  private ipLimit(): number {
    const raw = Number(process.env.VALIDATE_IP_LIMIT);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IP_LIMIT;
  }

  private ipWindowHours(): number {
    const raw = Number(process.env.VALIDATE_IP_WINDOW_HOURS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IP_WINDOW_HOURS;
  }

  private async checkIpLimit(ip: string | null): Promise<void> {
    if (!ip) return; // no proxy IP header (e.g. local dev) — nothing to key on
    const limit = this.ipLimit();
    const windowStart = new Date(
      Date.now() - this.ipWindowHours() * 60 * 60 * 1000,
    );
    const usedByIp = await this.prisma.validationRequest.count({
      where: { ip, requestedAt: { gte: windowStart } },
    });
    if (usedByIp >= limit) {
      this.logger.warn(
        { ip, usedByIp, limit },
        "AI validation blocked — IP rate limit",
      );
      throw new ForbiddenException({ remaining: 0, reason: "ip_limit" });
    }
  }

  private async limitFor(): Promise<number> {
    const planFeature = await this.prisma.planFeature.findUnique({
      where: {
        planId_featureId: {
          planId: FREE_PLAN_ID,
          featureId: AI_VALIDATION_FEATURE_ID,
        },
      },
    });
    return planFeature?.limitValue ?? 0;
  }

  async getQuota(userId: string): Promise<QuotaInfo> {
    const limit = await this.limitFor();
    const used = await this.prisma.validationRequest.count({
      where: { userId, status: "done" },
    });
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  async validate(
    userId: string,
    ip: string | null = null,
  ): Promise<{ results: TradeValidationDto[]; remaining: number }> {
    await this.checkIpLimit(ip);

    const limit = await this.limitFor();
    const usedBefore = await this.prisma.validationRequest.count({
      where: { userId, status: "done" },
    });
    if (usedBefore >= limit) {
      throw new ForbiddenException({ remaining: 0 });
    }

    const openTrades = await this.prisma.trade.findMany({
      where: activeTradeWhere({ userId, status: "open" }),
    });
    if (openTrades.length === 0) {
      throw new BadRequestException("No open trades to validate");
    }

    const tickers = openTrades.map((t) => t.ticker);
    const [currentPrices, newsByTicker] = await Promise.all([
      fetchCurrentPrices(tickers),
      fetchNewsForTickers(tickers),
    ]);
    const tradesForPrompt: TradeForPrompt[] = openTrades.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      entryPrice: t.entryPrice,
      shares: t.shares,
      entryDate: t.entryDate.toISOString().slice(0, 10),
      plannedTP: t.plannedTP as number[],
      plannedSL: t.plannedSL,
      notes: t.notes,
      currentPrice: currentPrices[t.ticker] ?? null,
      news: newsByTicker[t.ticker] ?? [],
    }));

    const request = await this.prisma.validationRequest.create({
      data: {
        userId,
        status: "pending",
        tradesCount: tradesForPrompt.length,
        model: "claude-sonnet-5",
        ip,
      },
    });

    let outcome;
    try {
      outcome = await this.claude.validate(tradesForPrompt);
    } catch {
      await this.prisma.validationRequest.update({
        where: { id: request.id },
        data: { status: "failed" },
      });
      this.logger.error({ userId, status: "failed" }, "AI validation failed");
      throw new BadGatewayException("AI validation failed — please try again");
    }

    const openTradeIds = new Set(openTrades.map((t) => t.id));
    const promptByTradeId = new Map(tradesForPrompt.map((t) => [t.id, t]));
    const validResults = outcome.results
      .filter((r) => openTradeIds.has(r.tradeId))
      .map((r) => {
        const trade = promptByTradeId.get(r.tradeId);
        if (!trade) return r;
        const { result, overridden } = applyStopGuard(r, trade);
        if (overridden) {
          this.logger.warn(
            {
              userId,
              tradeId: r.tradeId,
              ticker: trade.ticker,
              modelStopBreached: r.stopBreached,
              modelAtRisk: r.atRisk,
              actualStopBreached: result.stopBreached,
              actualAtRisk: result.atRisk,
            },
            "AI validation stop guard override — model output didn't match the deterministic price/SL check",
          );
        }
        return result;
      });

    const validatedAt = new Date();
    for (const r of validResults) {
      const data = toTradeValidationWrite(r, validatedAt);
      await this.prisma.tradeValidation.upsert({
        where: { tradeId: r.tradeId },
        create: { tradeId: r.tradeId, ...data },
        update: data,
      });
    }

    await this.prisma.validationRequest.update({
      where: { id: request.id },
      data: {
        status: "done",
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
      },
    });
    this.logger.info(
      {
        userId,
        status: "done",
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
      },
      "AI validation done",
    );

    const usedAfter = usedBefore + 1;
    return {
      results: validResults.map((r) => ({
        ...r,
        validatedAt: validatedAt.toISOString(),
      })),
      remaining: Math.max(0, limit - usedAfter),
    };
  }
}
