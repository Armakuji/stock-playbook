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

function makeConfig(): ConfigService {
  return { get: () => "test-key" } as unknown as ConfigService;
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
});
