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
import { fetchCurrentPrice } from "./yahoo-price";

const FREE_PLAN_ID = "free";
const AI_VALIDATION_FEATURE_ID = "ai_validation";

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
  ): Promise<{ results: TradeValidationDto[]; remaining: number }> {
    const limit = await this.limitFor();
    const usedBefore = await this.prisma.validationRequest.count({
      where: { userId, status: "done" },
    });
    if (usedBefore >= limit) {
      throw new ForbiddenException({ remaining: 0 });
    }

    const openTrades = await this.prisma.trade.findMany({
      where: { userId, status: "open" },
    });
    if (openTrades.length === 0) {
      throw new BadRequestException("No open trades to validate");
    }

    const tradesForPrompt: TradeForPrompt[] = await Promise.all(
      openTrades.map(async (t) => ({
        id: t.id,
        ticker: t.ticker,
        entryPrice: t.entryPrice,
        shares: t.shares,
        entryDate: t.entryDate.toISOString().slice(0, 10),
        plannedTP: t.plannedTP as number[],
        plannedSL: t.plannedSL,
        notes: t.notes,
        currentPrice: await fetchCurrentPrice(t.ticker),
      })),
    );

    const request = await this.prisma.validationRequest.create({
      data: {
        userId,
        status: "pending",
        tradesCount: tradesForPrompt.length,
        model: "claude-sonnet-5",
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
    const validResults = outcome.results.filter((r) =>
      openTradeIds.has(r.tradeId),
    );

    const validatedAt = new Date();
    for (const r of validResults) {
      await this.prisma.tradeValidation.upsert({
        where: { tradeId: r.tradeId },
        create: {
          tradeId: r.tradeId,
          verdict: r.verdict,
          thesisIntact: r.thesisIntact,
          stopBreached: r.stopBreached,
          atRisk: r.atRisk,
          summary: r.summary,
          action: r.action,
          color: r.color,
          validatedAt,
        },
        update: {
          verdict: r.verdict,
          thesisIntact: r.thesisIntact,
          stopBreached: r.stopBreached,
          atRisk: r.atRisk,
          summary: r.summary,
          action: r.action,
          color: r.color,
          validatedAt,
        },
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
