import type { Article, PinboardItem } from "./types";

const FEED_URL = "https://feeds.pinboard.in/json/popular/";

async function retryFetch(url: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`HTTP error: ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export async function fetchFeed(): Promise<Article[]> {
  const res = await retryFetch(FEED_URL);
  const items: PinboardItem[] = await res.json();

  return items.map((item) => ({
    url: item.u,
    title: item.d,
    description: item.n,
    tags: item.t,
  }));
}
