import { fetchCurrentPrice } from "./yahoo-price";

describe("fetchCurrentPrice", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the regular market price from a successful Yahoo response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => ({
        chart: {
          result: [
            { meta: { regularMarketPrice: 131.38, chartPreviousClose: 128.4 } },
          ],
        },
      }),
    });

    const price = await fetchCurrentPrice("NVDA");
    expect(price).toBe(131.38);
  });

  it("falls back to chartPreviousClose when regularMarketPrice is missing", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => ({
        chart: { result: [{ meta: { chartPreviousClose: 128.4 } }] },
      }),
    });

    const price = await fetchCurrentPrice("NVDA");
    expect(price).toBe(128.4);
  });

  it("returns null when the fetch fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await fetchCurrentPrice("NVDA")).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    expect(await fetchCurrentPrice("NVDA")).toBeNull();
  });

  it("returns null when the response has no usable price", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => ({ chart: { result: [{ meta: {} }] } }),
    });
    expect(await fetchCurrentPrice("NVDA")).toBeNull();
  });
});
