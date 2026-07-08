import { fetchNewsForTickers } from "./yahoo-news";

describe("fetchNewsForTickers", () => {
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

    it("returns parsed headlines from a successful Yahoo response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => ({
          news: [
            {
              title: "Broadcom beats on AI revenue",
              publisher: "Reuters",
              link: "https://example.com/1",
              providerPublishTime: 1783518971,
            },
          ],
        }),
      });

      const news = await fetchNewsForTickers(["AVGO"]);
      expect(news.AVGO).toHaveLength(1);
      expect(news.AVGO[0]).toMatchObject({
        title: "Broadcom beats on AI revenue",
        publisher: "Reuters",
        link: "https://example.com/1",
      });
    });

    it("returns an empty array for a ticker when Yahoo fails", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
      const news = await fetchNewsForTickers(["AVGO"]);
      expect(news.AVGO).toEqual([]);
    });

    it("returns an empty array when fetch throws", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
      const news = await fetchNewsForTickers(["AVGO"]);
      expect(news.AVGO).toEqual([]);
    });

    it("filters out news items missing required fields", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => ({
          news: [{ title: "Missing publisher/link" }],
        }),
      });
      const news = await fetchNewsForTickers(["AVGO"]);
      expect(news.AVGO).toEqual([]);
    });
  });

  describe("with WEB_ORIGIN set (proxy via Vercel /api/news)", () => {
    beforeEach(() => {
      process.env.WEB_ORIGIN = "https://stockplaybook.app";
    });

    it("uses the proxy response and never calls Yahoo directly", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => ({
          AVGO: [
            {
              title: "Broadcom beats on AI revenue",
              publisher: "Reuters",
              link: "https://example.com/1",
              publishedAt: "2026-07-08T00:00:00.000Z",
            },
          ],
        }),
      });

      const news = await fetchNewsForTickers(["AVGO"]);
      expect(news.AVGO).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://stockplaybook.app/api/news?tickers=AVGO&count=3",
        expect.anything(),
      );
    });

    it("falls back to direct Yahoo for a ticker the proxy returned empty for", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => ({ AVGO: [] }), // proxy: no news
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => ({
            news: [
              {
                title: "Direct Yahoo headline",
                publisher: "Bloomberg",
                link: "https://example.com/2",
                providerPublishTime: 1783518971,
              },
            ],
          }),
        });

      const news = await fetchNewsForTickers(["AVGO"]);
      expect(news.AVGO).toHaveLength(1);
      expect(news.AVGO[0].title).toBe("Direct Yahoo headline");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("never throws — a ticker with no news anywhere resolves to an empty array", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });
      const news = await fetchNewsForTickers(["AVGO"]);
      expect(news.AVGO).toEqual([]);
    });
  });
});
