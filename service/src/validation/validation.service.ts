import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { PrismaService } from "../prisma/prisma.service";
import { ClaudeClient } from "./claude.client";
import { TradeForPrompt } from "./prompt";
import { toTradeValidationWrite } from "./validation.mapper";
import { fetchCurrentPrices } from "./yahoo-price";
import { fetchNewsForTickers } from "./yahoo-news";
import {
  ModelValidation,
  ValidationResult,
  applyTradeRules,
  computeTradeMetrics,
  isFullyExited,
} from "./trade-rules";
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

// A pending request younger than this still holds a quota slot — covers the
// Claude call (90s timeout) plus one coverage retry with margin. Older pending
// rows are treated as crashed and no longer block the user.
const PENDING_HOLDS_QUOTA_MS = 10 * 60 * 1000;

export type TradeValidationDto = ValidationResult & { validatedAt: string };

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

  /** Requests that consume (or are about to consume) a quota slot. */
  private quotaWhere(userId: string) {
    return {
      userId,
      OR: [
        { status: "done" },
        {
          status: "pending",
          requestedAt: { gte: new Date(Date.now() - PENDING_HOLDS_QUOTA_MS) },
        },
      ],
    };
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
    // Cheap pre-check so an exhausted user is rejected before any price/news
    // fetch. The authoritative check is repeated under a per-user lock below.
    const usedBefore = await this.prisma.validationRequest.count({
      where: this.quotaWhere(userId),
    });
    if (usedBefore >= limit) {
      throw new ForbiddenException({ remaining: 0 });
    }

    const fetched = await this.prisma.trade.findMany({
      where: activeTradeWhere({ userId, status: "open" }),
      include: { exits: true },
    });
    // Auto-close guard (mirrors the CLI skill): status "open" but every share
    // already exited → treat as closed, don't spend tokens on it.
    const openTrades = fetched.filter((t) => {
      const exited = (t.exits ?? []).reduce((sum, e) => sum + e.shares, 0);
      if (isFullyExited(t.shares, exited)) {
        this.logger.warn(
          { userId, tradeId: t.id, ticker: t.ticker },
          "AI validation skipped fully-exited trade still marked open",
        );
        return false;
      }
      return true;
    });
    if (openTrades.length === 0) {
      throw new BadRequestException("No open trades to validate");
    }

    const tickers = openTrades.map((t) => t.ticker);
    const [currentPrices, newsByTicker] = await Promise.all([
      fetchCurrentPrices(tickers),
      fetchNewsForTickers(tickers),
    ]);
    const today = new Date();
    const tradesForPrompt: TradeForPrompt[] = openTrades.map((t) => {
      const base = {
        entryPrice: t.entryPrice,
        shares: t.shares,
        exitedShares: (t.exits ?? []).reduce((sum, e) => sum + e.shares, 0),
        entryDate: t.entryDate.toISOString().slice(0, 10),
        plannedTP: t.plannedTP as number[],
        plannedSL: t.plannedSL,
        plannedHardSL: t.plannedHardSL ?? null,
        currentPrice: currentPrices[t.ticker] ?? null,
      };
      return {
        ...base,
        id: t.id,
        ticker: t.ticker,
        catalystType: t.catalystType ?? null,
        notes: t.notes,
        news: newsByTicker[t.ticker] ?? [],
        metrics: computeTradeMetrics(base, today),
      };
    });

    // Authoritative quota check + pending-row creation under a per-user
    // advisory lock, so N parallel clicks can't all pass a count taken
    // before any of them wrote a row (TOCTOU → quota overrun).
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
      const used = await tx.validationRequest.count({
        where: this.quotaWhere(userId),
      });
      if (used >= limit) {
        throw new ForbiddenException({ remaining: 0 });
      }
      return tx.validationRequest.create({
        data: {
          userId,
          status: "pending",
          tradesCount: tradesForPrompt.length,
          model: this.claude.modelName,
          ip,
        },
      });
    });

    let modelResults: ModelValidation[];
    let inputTokens: number;
    let outputTokens: number;
    try {
      const outcome = await this.claude.validate(tradesForPrompt, today);
      modelResults = outcome.results;
      inputTokens = outcome.inputTokens;
      outputTokens = outcome.outputTokens;
    } catch {
      await this.prisma.validationRequest.update({
        where: { id: request.id },
        data: { status: "failed" },
      });
      this.logger.error({ userId, status: "failed" }, "AI validation failed");
      throw new BadGatewayException("AI validation failed — please try again");
    }

    const promptByTradeId = new Map(tradesForPrompt.map((t) => [t.id, t]));
    // Keep only the user's trades, first answer wins on duplicates.
    const byTradeId = new Map<string, ModelValidation>();
    const collect = (results: ModelValidation[]) => {
      for (const r of results) {
        if (promptByTradeId.has(r.tradeId) && !byTradeId.has(r.tradeId)) {
          byTradeId.set(r.tradeId, r);
        }
      }
    };
    collect(modelResults);

    // Coverage check: the model occasionally drops a trade. Retry once for
    // just the missing ones; a retry failure keeps the partial results
    // instead of failing a request the user already paid quota for.
    const missing = tradesForPrompt.filter((t) => !byTradeId.has(t.id));
    if (missing.length > 0) {
      this.logger.warn(
        { userId, missing: missing.map((t) => t.id) },
        "AI validation missing trades — retrying once",
      );
      try {
        const retry = await this.claude.validate(missing, today);
        inputTokens += retry.inputTokens;
        outputTokens += retry.outputTokens;
        collect(retry.results);
      } catch {
        this.logger.warn({ userId }, "AI validation coverage retry failed");
      }
      const stillMissing = tradesForPrompt.filter((t) => !byTradeId.has(t.id));
      if (stillMissing.length > 0) {
        this.logger.warn(
          { userId, missing: stillMissing.map((t) => t.id) },
          "AI validation still missing trades after retry — previous validation (if any) kept",
        );
      }
    }
    if (byTradeId.size === 0) {
      await this.prisma.validationRequest.update({
        where: { id: request.id },
        data: { status: "failed", inputTokens, outputTokens },
      });
      this.logger.error(
        { userId, status: "failed" },
        "AI validation returned no usable results",
      );
      throw new BadGatewayException("AI validation failed — please try again");
    }

    const validResults: ValidationResult[] = [];
    for (const [tradeId, modelResult] of byTradeId) {
      const trade = promptByTradeId.get(tradeId)!;
      const { result, overrides } = applyTradeRules(
        modelResult,
        trade,
        trade.metrics,
      );
      if (overrides.length > 0) {
        this.logger.warn(
          {
            userId,
            tradeId,
            ticker: trade.ticker,
            stopStatus: trade.metrics.stopStatus,
            overrides,
          },
          "AI validation rule override — model output didn't match the deterministic rules",
        );
      }
      validResults.push(result);
    }

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
      data: { status: "done", inputTokens, outputTokens },
    });
    this.logger.info(
      { userId, status: "done", inputTokens, outputTokens },
      "AI validation done",
    );

    const usedAfter = await this.prisma.validationRequest.count({
      where: { userId, status: "done" },
    });
    return {
      results: validResults.map((r) => ({
        ...r,
        validatedAt: validatedAt.toISOString(),
      })),
      remaining: Math.max(0, limit - usedAfter),
    };
  }
}
