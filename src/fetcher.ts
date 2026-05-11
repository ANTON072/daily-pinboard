import type { Article, DevToArticle, FeedSource, PinboardItem } from "./types";

const FEED_URL = "https://feeds.pinboard.in/json/popular/";
const DEVTO_API_URL = "https://dev.to/api/articles?top=7&per_page=50";
const RETRY_DELAYS_MS = [5_000, 10_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchDevToFeed(): Promise<Article[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
    try {
      const res = await fetch(DEVTO_API_URL);
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      const items: unknown = await res.json();
      if (!Array.isArray(items)) {
        throw new Error(`Unexpected response format: ${typeof items}`);
      }
      return (items as DevToArticle[]).map((item) => ({
        url: item.url,
        title: item.title,
        description: item.description ?? "",
        tags: item.tag_list ?? [],
      }));
    } catch (err) {
      console.warn(`dev.to fetch failed (attempt ${attempt + 1}):`, err);
      lastError = err;
    }
  }

  throw lastError;
}

export async function fetchFeed(): Promise<{ articles: Article[]; source: FeedSource }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
    try {
      const res = await fetch(FEED_URL);
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      const items: unknown = await res.json();
      if (!Array.isArray(items)) {
        throw new Error(`Unexpected response format: ${typeof items}`);
      }
      const articles = (items as PinboardItem[]).map((item) => ({
        url: item.u,
        title: item.d,
        description: item.n,
        tags: item.t,
      }));
      return { articles, source: "pinboard" };
    } catch (err) {
      console.warn(`Pinboard fetch failed (attempt ${attempt + 1}):`, err);
      lastError = err;
    }
  }

  console.warn("Pinboard all retries failed, falling back to dev.to:", lastError);
  const articles = await fetchDevToFeed();
  return { articles, source: "devto" };
}
