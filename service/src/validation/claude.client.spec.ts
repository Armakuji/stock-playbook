import { ConfigService } from "@nestjs/config";
import { ClaudeClient } from "./claude.client";
import { TradeForPrompt } from "./prompt";

const trade: TradeForPrompt = {
  id: "trade-1",
  ticker: "AVGO",
  entryPrice: 389.55,
  shares: 5,
  entryDate: "2026-06-01",
  plannedTP: [420, 460, 500],
  plannedSL: 360,
  notes: null,
  currentPrice: 396.3,
};

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const values: Record<string, string | undefined> = { ANTHROPIC_API_KEY: "test-key", ...overrides };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe("ClaudeClient", () => {
  it("calls messages.create with the forced tool and returns parsed results + usage", async () => {
    const create = jest.fn().mockResolvedValue({
      stop_reason: "tool_use",
      usage: { input_tokens: 500, output_tokens: 120 },
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "submit_validation",
          input: {
            results: [
              {
                tradeId: "trade-1",
                verdict: "HOLD",
                thesisIntact: true,
                stopBreached: false,
                atRisk: false,
                summary: "on track",
                action: "hold",
                color: "green",
              },
            ],
          },
        },
      ],
    });
    const client = new ClaudeClient(makeConfig());
    (client as unknown as { client: { messages: { create: typeof create } } }).client = {
      messages: { create },
    };

    const result = await client.validate([trade]);

    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0];
    expect(params.model).toBe("claude-sonnet-5");
    expect(params.tool_choice).toEqual({ type: "tool", name: "submit_validation" });
    expect(options).toEqual({ timeout: 90_000 });

    expect(result.results).toHaveLength(1);
    expect(result.inputTokens).toBe(500);
    expect(result.outputTokens).toBe(120);
  });

  it("propagates errors from the API call (caller decides how to record failure)", async () => {
    const create = jest.fn().mockRejectedValue(new Error("timeout"));
    const client = new ClaudeClient(makeConfig());
    (client as unknown as { client: { messages: { create: typeof create } } }).client = {
      messages: { create },
    };

    await expect(client.validate([trade])).rejects.toThrow("timeout");
  });

  it("uses ANTHROPIC_MODEL from config when set, overriding the default", async () => {
    const create = jest.fn().mockResolvedValue({
      stop_reason: "tool_use",
      usage: { input_tokens: 500, output_tokens: 120 },
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "submit_validation",
          input: { results: [] },
        },
      ],
    });
    const client = new ClaudeClient(makeConfig({ ANTHROPIC_MODEL: "claude-opus-5" }));
    (client as unknown as { client: { messages: { create: typeof create } } }).client = {
      messages: { create },
    };

    await client.validate([trade]);

    const [params] = create.mock.calls[0];
    expect(params.model).toBe("claude-opus-5");
  });

  it("falls back to the default model when ANTHROPIC_MODEL is not set", async () => {
    const create = jest.fn().mockResolvedValue({
      stop_reason: "tool_use",
      usage: { input_tokens: 500, output_tokens: 120 },
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "submit_validation",
          input: { results: [] },
        },
      ],
    });
    const client = new ClaudeClient(makeConfig());
    (client as unknown as { client: { messages: { create: typeof create } } }).client = {
      messages: { create },
    };

    await client.validate([trade]);

    const [params] = create.mock.calls[0];
    expect(params.model).toBe("claude-sonnet-5");
  });
});
