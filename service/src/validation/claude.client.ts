import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import {
  TradeForPrompt,
  VALIDATION_TOOL,
  buildValidationMessages,
  parseValidationToolUse,
} from "./prompt";
import type { ModelValidation } from "./trade-rules";

const DEFAULT_MODEL = "claude-sonnet-5";
// Output budget scales with trade count: each result is a bilingual EN/TH
// pair and Thai is token-heavy (~400-600 output tokens per trade). A fixed
// 4096 silently truncated the tool call for ~8+ open trades.
const BASE_OUTPUT_TOKENS = 1024;
const OUTPUT_TOKENS_PER_TRADE = 700;
const MAX_OUTPUT_TOKENS = 32_000;
const TIMEOUT_MS = 90_000;

export function maxTokensFor(tradeCount: number): number {
  return Math.min(
    MAX_OUTPUT_TOKENS,
    BASE_OUTPUT_TOKENS + OUTPUT_TOKENS_PER_TRADE * Math.max(1, tradeCount),
  );
}

export interface ClaudeValidationResult {
  results: ModelValidation[];
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class ClaudeClient {
  private readonly client: Anthropic;
  // Overridable via ANTHROPIC_MODEL so the model can be swapped (e.g. a new
  // Claude release) with just an env var change + restart — no redeploy.
  private readonly model: string;

  constructor(config: ConfigService) {
    this.client = new Anthropic({
      apiKey: config.get<string>("ANTHROPIC_API_KEY"),
    });
    this.model = config.get<string>("ANTHROPIC_MODEL") || DEFAULT_MODEL;
  }

  /** The model id actually used — recorded on validation_requests for audit/cost. */
  get modelName(): string {
    return this.model;
  }

  async validate(
    trades: TradeForPrompt[],
    today: Date = new Date(),
  ): Promise<ClaudeValidationResult> {
    const { system, user } = buildValidationMessages(trades, today);

    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: maxTokensFor(trades.length),
        thinking: { type: "disabled" },
        output_config: { effort: "medium" },
        system,
        messages: [{ role: "user", content: user }],
        tools: [VALIDATION_TOOL],
        tool_choice: { type: "tool", name: "submit_validation" },
      },
      { timeout: TIMEOUT_MS },
    );

    if (response.stop_reason === "max_tokens") {
      // A truncated forced tool call is incomplete JSON — never trust it.
      throw new Error(
        `Claude response truncated at max_tokens (${maxTokensFor(trades.length)}) for ${trades.length} trades`,
      );
    }

    const results = parseValidationToolUse(response.content);
    return {
      results,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
