// Fetches recent per-ticker headlines to give the AI validator real news
// context (backlog: "does validation check news?" — previously no). Mirrors
// the yahoo-price.ts pattern: prefer the Vercel-hosted /api/news proxy
// (WEB_ORIGIN) since Yahoo blocks/rate-limits Railway's egress far more than
// Vercel's; fall back to a direct Yahoo call for local dev / proxy failure.

export interface NewsHeadline {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string | null; // ISO string; null when Yahoo gave no time
}

interface YahooNewsItem {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  relatedTickers?: string[];
}

const HEADLINES_PER_TICKER = 3;
// Yahoo's search endpoint matches the query as free text, so short tickers
// (FLY, ON, SERV…) pull in unrelated stories. Over-fetch, then keep only
// items Yahoo tags with this ticker (untagged items are kept — can't tell).
const FETCH_COUNT = 10;

export function isRelevantToTicker(
  item: { relatedTickers?: string[] },
  ticker: string,
): boolean {
  const related = item.relatedTickers;
  if (!Array.isArray(related) || related.length === 0) return true;
  const want = ticker.toUpperCase();
  return related.some((r) => typeof r === "string" && r.toUpperCase() === want);
}

async function fetchFromYahooDirect(ticker: string): Promise<NewsHeadline[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=${FETCH_COUNT}&quotesCount=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(
        `[yahoo-news] direct fetch for ${ticker} failed: HTTP ${res.status} ${res.statusText}`,
      );
      return [];
    }

    const data = (await res.json()) as { news?: YahooNewsItem[] };
    const items = data?.news ?? [];
    return items
      .filter(
        (
          n,
        ): n is YahooNewsItem & {
          title: string;
          publisher: string;
          link: string;
        } =>
          typeof n.title === "string" &&
          typeof n.publisher === "string" &&
          typeof n.link === "string",
      )
      .filter((n) => isRelevantToTicker(n, ticker))
      .slice(0, HEADLINES_PER_TICKER)
      .map((n) => ({
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        publishedAt: n.providerPublishTime
          ? new Date(n.providerPublishTime * 1000).toISOString()
          : null,
      }));
  } catch (err) {
    console.warn(
      `[yahoo-news] direct fetch for ${ticker} threw: ${String(err)}`,
    );
    return [];
  }
}

async function fetchViaWebProxy(
  tickers: string[],
): Promise<Record<string, NewsHeadline[]>> {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) return {};

  try {
    const url = `${webOrigin}/api/news?tickers=${encodeURIComponent(tickers.join(","))}&count=${HEADLINES_PER_TICKER}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(
        `[yahoo-news] web proxy fetch failed: HTTP ${res.status} ${res.statusText}`,
      );
      return {};
    }
    return (await res.json()) as Record<string, NewsHeadline[]>;
  } catch (err) {
    console.warn(`[yahoo-news] web proxy fetch threw: ${String(err)}`);
    return {};
  }
}

/**
 * Fetches recent headlines for multiple tickers in one batch. Prefers the
 * Vercel-hosted /api/news proxy; falls back to a direct per-ticker Yahoo
 * call for any ticker the proxy didn't return (or returned empty for).
 * Never throws — a missing news source degrades to an empty headline list,
 * it should never block trade validation from running.
 */
export async function fetchNewsForTickers(
  tickers: string[],
): Promise<Record<string, NewsHeadline[]>> {
  const uniqueTickers = [...new Set(tickers)];
  const proxyNews = await fetchViaWebProxy(uniqueTickers);

  const missing = uniqueTickers.filter(
    (t) => !proxyNews[t] || proxyNews[t].length === 0,
  );
  const directResults = await Promise.all(
    missing.map(async (t) => [t, await fetchFromYahooDirect(t)] as const),
  );

  const result: Record<string, NewsHeadline[]> = { ...proxyNews };
  for (const [ticker, headlines] of directResults) {
    if (headlines.length > 0) result[ticker] = headlines;
  }
  for (const ticker of uniqueTickers) {
    if (!result[ticker]) result[ticker] = [];
  }
  return result;
}
