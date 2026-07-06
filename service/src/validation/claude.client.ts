import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import {
  TradeForPrompt,
  ValidationToolResult,
  VALIDATION_TOOL,
  buildValidationMessages,
  parseValidationToolUse,
} from "./prompt";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 90_000;

export interface ClaudeValidationResult {
  results: ValidationToolResult[];
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class ClaudeClient {
  private readonly client: Anthropic;

  constructor(config: ConfigService) {
    this.client = new Anthropic({
      apiKey: config.get<string>("ANTHROPIC_API_KEY"),
    });
  }

  async validate(trades: TradeForPrompt[]): Promise<ClaudeValidationResult> {
    const { system, user } = buildValidationMessages(trades);

    const response = await this.client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "disabled" },
        output_config: { effort: "medium" },
        system,
        messages: [{ role: "user", content: user }],
        tools: [VALIDATION_TOOL],
        tool_choice: { type: "tool", name: "submit_validation" },
      },
      { timeout: TIMEOUT_MS },
    );

    const results = parseValidationToolUse(response.content);
    return {
      results,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
