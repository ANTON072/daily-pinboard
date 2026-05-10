import type { Article, PinboardItem } from "./types";

const FEED_URL = "https://feeds.pinboard.in/json/popular/";
const RETRY_DELAYS_MS = [5_000, 10_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchFeed(): Promise<Article[]> {
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
      return (items as PinboardItem[]).map((item) => ({
        url: item.u,
        title: item.d,
        description: item.n,
        tags: item.t,
      }));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
