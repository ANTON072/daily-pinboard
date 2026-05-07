import { beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeArticles } from "./summarizer";
import type { FetchedArticle } from "./types";

const makeFetchedArticle = (n: number): FetchedArticle => ({
  url: `https://example.com/${n}`,
  title: `Article ${n}`,
  description: `Description ${n}`,
  tags: [],
  score: 10 - n,
  fetchedTitle: `Fetched Title ${n}`,
  fetchedDescription: `Fetched Description ${n}`,
  bodyText: `Body text for article ${n}`,
});

const mockOpenAISummaryResponse = (summary: string) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: summary,
        },
      },
    ],
  }),
});

describe("summarizeArticles", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("各記事に summary フィールドが追加された SummarizedArticle を返す", async () => {
    const articles = [makeFetchedArticle(1), makeFetchedArticle(2)];
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(mockOpenAISummaryResponse("記事1の日本語要約です。"))
      .mockResolvedValueOnce(mockOpenAISummaryResponse("記事2の日本語要約です。"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await summarizeArticles(articles, "test-api-key");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ ...articles[0], summary: "記事1の日本語要約です。" });
    expect(result[1]).toMatchObject({ ...articles[1], summary: "記事2の日本語要約です。" });
  });

  it("記事ごとに個別の OpenAI 呼び出しを行う", async () => {
    const articles = [makeFetchedArticle(1), makeFetchedArticle(2), makeFetchedArticle(3)];
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockOpenAISummaryResponse("日本語要約"));
    vi.stubGlobal("fetch", mockFetch);

    await summarizeArticles(articles, "test-api-key");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("プロンプトに title, fetchedDescription, bodyText を含める", async () => {
    const article = makeFetchedArticle(1);
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOpenAISummaryResponse("要約"));
    vi.stubGlobal("fetch", mockFetch);

    await summarizeArticles([article], "test-api-key");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const content = body.messages[1].content;
    expect(content).toContain("Fetched Title 1");
    expect(content).toContain("Fetched Description 1");
    expect(content).toContain("Body text for article 1");
  });

  it("fetchedTitle が空の場合は title にフォールバックする", async () => {
    const article: FetchedArticle = {
      ...makeFetchedArticle(1),
      fetchedTitle: "",
      fetchedDescription: "",
    };
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOpenAISummaryResponse("要約"));
    vi.stubGlobal("fetch", mockFetch);

    await summarizeArticles([article], "test-api-key");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const content = body.messages[1].content;
    expect(content).toContain("Article 1");
    expect(content).toContain("Description 1");
  });

  it("OpenAI API キーを Authorization ヘッダーに含める", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOpenAISummaryResponse("要約"));
    vi.stubGlobal("fetch", mockFetch);

    await summarizeArticles([makeFetchedArticle(1)], "my-secret-key");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer my-secret-key");
  });

  it("OpenAI API がエラーを返した場合はエラーをスロー", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      }),
    );

    await expect(summarizeArticles([makeFetchedArticle(1)], "test-api-key")).rejects.toThrow();
  });

  it("空配列を渡した場合は空配列を返す", async () => {
    const result = await summarizeArticles([], "test-api-key");
    expect(result).toEqual([]);
  });

  it("元の記事フィールドがすべて保持される", async () => {
    const article = makeFetchedArticle(1);
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOpenAISummaryResponse("要約テキスト"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await summarizeArticles([article], "test-api-key");

    expect(result[0].url).toBe(article.url);
    expect(result[0].title).toBe(article.title);
    expect(result[0].description).toBe(article.description);
    expect(result[0].tags).toEqual(article.tags);
    expect(result[0].score).toBe(article.score);
    expect(result[0].fetchedTitle).toBe(article.fetchedTitle);
    expect(result[0].fetchedDescription).toBe(article.fetchedDescription);
    expect(result[0].bodyText).toBe(article.bodyText);
    expect(result[0].summary).toBe("要約テキスト");
  });
});
