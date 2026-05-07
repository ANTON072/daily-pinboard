import type { ScoredArticle } from "./types";

const EXPIRY_DAYS = 90;

export async function deduplicateArticles(
  articles: ScoredArticle[],
  db: D1Database,
): Promise<ScoredArticle[]> {
  if (articles.length === 0) return [];

  const placeholders = articles.map(() => "?").join(", ");
  const urls = articles.map((a) => a.url);

  const result = await db
    .prepare(`SELECT url FROM sent_articles WHERE url IN (${placeholders})`)
    .bind(...urls)
    .all<{ url: string }>();

  const sentUrls = new Set(result.results.map((r) => r.url));
  return articles.filter((a) => !sentUrls.has(a.url));
}

export async function cleanupExpiredRecords(db: D1Database): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - EXPIRY_DAYS);
  const cutoffStr = cutoff.toISOString();

  await db.prepare("DELETE FROM sent_articles WHERE sent_at < ?").bind(cutoffStr).run();
}

export async function recordSentArticles(urls: string[], db: D1Database): Promise<void> {
  if (urls.length === 0) return;

  const sentAt = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO sent_articles (url, sent_at) VALUES (?, ?) ON CONFLICT (url) DO UPDATE SET sent_at = excluded.sent_at",
  );

  for (const url of urls) {
    await stmt.bind(url, sentAt).run();
  }
}
