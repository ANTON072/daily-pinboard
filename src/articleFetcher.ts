import type { FetchedArticle, ScoredArticle } from "./types";

function extractTagContent(html: string, tag: string): string {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTitle(html: string): string {
  const content = extractTagContent(html, "title");
  return stripTags(content);
}

function extractDescription(html: string): string {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  return match ? match[1] : "";
}

function extractBodyText(html: string): string {
  const article = extractTagContent(html, "article");
  if (article) return stripTags(article).slice(0, 3000);

  const main = extractTagContent(html, "main");
  if (main) return stripTags(main).slice(0, 3000);

  const body = extractTagContent(html, "body");
  return stripTags(body).slice(0, 3000);
}

export async function fetchArticles(articles: ScoredArticle[]): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = [];

  for (const article of articles) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(article.url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const html = await res.text();

      results.push({
        ...article,
        fetchedTitle: extractTitle(html),
        fetchedDescription: extractDescription(html),
        bodyText: extractBodyText(html),
      });
    } catch (err) {
      console.error(`Failed to fetch ${article.url}:`, err);
    } finally {
      clearTimeout(timer);
    }
  }

  return results;
}
