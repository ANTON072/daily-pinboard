import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchArticles } from "./articleFetcher";
import type { ScoredArticle } from "./types";

const makeArticle = (url: string): ScoredArticle => ({
  url,
  title: `Title for ${url}`,
  description: `Desc for ${url}`,
  tags: [],
  score: 7,
});

function makeHtmlResponse(html: string) {
  return {
    ok: true,
    text: async () => html,
  };
}

describe("fetchArticles", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("<article>タグがある場合はその内容を本文として抽出する", async () => {
    const html = `
      <html>
        <head><title>Test Title</title><meta name="description" content="Test description"></head>
        <body>
          <article>Article content here</article>
          <main>Main content here</main>
        </body>
      </html>
    `;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const articles = [makeArticle("https://example.com/1")];
    const result = await fetchArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0].bodyText).toContain("Article content here");
    expect(result[0].bodyText).not.toContain("Main content here");
  });

  it("<article>がない場合は<main>タグの内容を本文として抽出する", async () => {
    const html = `
      <html>
        <head><title>Test Title</title></head>
        <body>
          <main>Main content here</main>
        </body>
      </html>
    `;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const articles = [makeArticle("https://example.com/1")];
    const result = await fetchArticles(articles);

    expect(result[0].bodyText).toContain("Main content here");
  });

  it("<article>も<main>もない場合は<body>タグの内容を本文として抽出する", async () => {
    const html = `
      <html>
        <head><title>Test Title</title></head>
        <body>Body content here</body>
      </html>
    `;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const articles = [makeArticle("https://example.com/1")];
    const result = await fetchArticles(articles);

    expect(result[0].bodyText).toContain("Body content here");
  });

  it("<title>タグからfetchedTitleを抽出する", async () => {
    const html = `<html><head><title>Fetched Title</title></head><body>content</body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const result = await fetchArticles([makeArticle("https://example.com/1")]);

    expect(result[0].fetchedTitle).toBe("Fetched Title");
  });

  it("<meta name='description'>からfetchedDescriptionを抽出する", async () => {
    const html = `
      <html>
        <head>
          <title>Title</title>
          <meta name="description" content="Meta description text">
        </head>
        <body>content</body>
      </html>
    `;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const result = await fetchArticles([makeArticle("https://example.com/1")]);

    expect(result[0].fetchedDescription).toBe("Meta description text");
  });

  it("本文が3000文字を超える場合は先頭3000文字に切り詰める", async () => {
    const longContent = "a".repeat(5000);
    const html = `<html><head><title>T</title></head><body><article>${longContent}</article></body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const result = await fetchArticles([makeArticle("https://example.com/1")]);

    expect(result[0].bodyText.length).toBeLessThanOrEqual(3000);
  });

  it("fetch失敗時はその記事をスキップしてconsole.errorを呼ぶ", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const articles = [makeArticle("https://example.com/1")];
    const result = await fetchArticles(articles);

    expect(result).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("HTTPエラー時はその記事をスキップする", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }));

    const articles = [makeArticle("https://example.com/1")];
    const result = await fetchArticles(articles);

    expect(result).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("タイムアウト時はその記事をスキップしてconsole.errorを呼ぶ", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })),
    );

    const articles = [makeArticle("https://example.com/1")];
    const result = await fetchArticles(articles);

    expect(result).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("複数記事の一部が失敗しても成功分を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = `<html><head><title>T</title></head><body>content</body></html>`;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(makeHtmlResponse(html)),
    );

    const articles = [makeArticle("https://fail.com"), makeArticle("https://ok.com")];
    const result = await fetchArticles(articles);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://ok.com");
  });

  it("ScoredArticleの既存フィールドを引き継ぐ", async () => {
    const html = `<html><head><title>T</title></head><body>content</body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const article = makeArticle("https://example.com/1");
    const result = await fetchArticles([article]);

    expect(result[0].url).toBe(article.url);
    expect(result[0].title).toBe(article.title);
    expect(result[0].score).toBe(article.score);
  });

  it("titleタグがない場合はfetchedTitleを空文字にする", async () => {
    const html = `<html><head></head><body>content</body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const result = await fetchArticles([makeArticle("https://example.com/1")]);

    expect(result[0].fetchedTitle).toBe("");
  });

  it("descriptionメタタグがない場合はfetchedDescriptionを空文字にする", async () => {
    const html = `<html><head><title>T</title></head><body>content</body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeHtmlResponse(html)));

    const result = await fetchArticles([makeArticle("https://example.com/1")]);

    expect(result[0].fetchedDescription).toBe("");
  });
});
