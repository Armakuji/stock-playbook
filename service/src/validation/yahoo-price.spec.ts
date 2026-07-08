import { fetchCurrentPrice, fetchCurrentPrices } from "./yahoo-price";

describe("fetchCurrentPrice(s)", () => {
  const originalFetch = global.fetch;
  const originalWebOrigin = process.env.WEB_ORIGIN;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.WEB_ORIGIN = originalWebOrigin;
  });

  describe("without WEB_ORIGIN (direct Yahoo fallback)", () => {
    beforeEach(() => {
      delete process.env.WEB_ORIGIN;
    });

    it("returns the regular market price from a successful Yahoo response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => ({
          chart: {
            result: [
              {
                meta: { regularMarketPrice: 131.38, chartPreviousClose: 128.4 },
              },
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
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
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

  describe("with WEB_ORIGIN set (proxy via Vercel /api/prices)", () => {
    beforeEach(() => {
      process.env.WEB_ORIGIN = "https://stockplaybook.app";
    });

    it("uses the proxy response and never calls Yahoo directly", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => ({
          NVDA: { price: 131.38 },
          AVGO: { price: 250.5 },
        }),
      });

      const prices = await fetchCurrentPrices(["NVDA", "AVGO"]);
      expect(prices).toEqual({ NVDA: 131.38, AVGO: 250.5 });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://stockplaybook.app/api/prices?tickers=NVDA%2CAVGO",
        expect.anything(),
      );
    });

    it("falls back to direct Yahoo for tickers missing from the proxy response", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => ({ NVDA: { price: 131.38 } }), // proxy: AVGO missing
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => ({
            chart: { result: [{ meta: { regularMarketPrice: 250.5 } }] },
          }), // direct Yahoo fallback for AVGO
        });

      const prices = await fetchCurrentPrices(["NVDA", "AVGO"]);
      expect(prices).toEqual({ NVDA: 131.38, AVGO: 250.5 });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("falls back to direct Yahoo entirely when the proxy fetch fails", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 502 }) // proxy fails
        .mockResolvedValueOnce({
          ok: true,
          json: () => ({
            chart: { result: [{ meta: { regularMarketPrice: 131.38 } }] },
          }),
        });

      const prices = await fetchCurrentPrices(["NVDA"]);
      expect(prices).toEqual({ NVDA: 131.38 });
    });

    it("dedupes tickers before fetching", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => ({ NVDA: { price: 131.38 } }),
      });

      await fetchCurrentPrices(["NVDA", "NVDA"]);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://stockplaybook.app/api/prices?tickers=NVDA",
        expect.anything(),
      );
    });
  });
});
