import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreStage1 } from "./scorer";
import type { Article } from "./types";

const mockArticles: Article[] = [
  {
    url: "https://example.com/1",
    title: "React 19 New Features",
    description: "React 19 brings exciting changes",
    tags: ["react"],
  },
  {
    url: "https://example.com/2",
    title: "TypeScript 5.5 Released",
    description: "New TypeScript features",
    tags: ["typescript"],
  },
  {
    url: "https://example.com/3",
    title: "CSS Grid Advanced",
    description: "Advanced CSS Grid techniques",
    tags: ["css"],
  },
  {
    url: "https://example.com/4",
    title: "Node.js Performance",
    description: "Performance tips for Node.js",
    tags: ["nodejs"],
  },
  {
    url: "https://example.com/5",
    title: "Web Components Guide",
    description: "Building web components",
    tags: ["webcomponents"],
  },
];

const mockOpenAIResponse = (scores: { url: string; score: number }[]) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({ articles: scores }),
        },
      },
    ],
  }),
});

describe("scoreStage1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("記事にスコアを付けてScoredArticle配列を返す", async () => {
    const scores = mockArticles.map((a, i) => ({ url: a.url, score: 10 - i }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOpenAIResponse(scores)));

    const result = await scoreStage1(mockArticles, "test-api-key");

    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({ url: "https://example.com/1", score: 10 });
    expect(result[0]).toHaveProperty("title");
    expect(result[0]).toHaveProperty("description");
    expect(result[0]).toHaveProperty("tags");
  });

  it("スコア降順にソートして返す", async () => {
    const scores = [
      { url: "https://example.com/3", score: 9 },
      { url: "https://example.com/1", score: 5 },
      { url: "https://example.com/2", score: 7 },
      { url: "https://example.com/4", score: 3 },
      { url: "https://example.com/5", score: 8 },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOpenAIResponse(scores)));

    const result = await scoreStage1(mockArticles, "test-api-key");

    expect(result[0].score).toBe(9);
    expect(result[1].score).toBe(8);
    expect(result[2].score).toBe(7);
    expect(result[3].score).toBe(5);
    expect(result[4].score).toBe(3);
  });

  it("上位30件を超えた場合は30件に絞る", async () => {
    const manyArticles: Article[] = Array.from({ length: 50 }, (_, i) => ({
      url: `https://example.com/${i + 1}`,
      title: `Article ${i + 1}`,
      description: `Description ${i + 1}`,
      tags: [],
    }));
    const scores = manyArticles.map((a, i) => ({ url: a.url, score: i % 11 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOpenAIResponse(scores)));

    const result = await scoreStage1(manyArticles, "test-api-key");

    expect(result.length).toBeLessThanOrEqual(30);
  });

  it("OpenAIにtitleとdescriptionを含むリクエストを送信する", async () => {
    const scores = mockArticles.map((a) => ({ url: a.url, score: 5 }));
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOpenAIResponse(scores));
    vi.stubGlobal("fetch", mockFetch);

    await scoreStage1(mockArticles, "test-api-key");

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const content = body.messages[1].content;

    expect(content).toContain("React 19 New Features");
    expect(content).toContain("TypeScript 5.5 Released");
  });

  it("OpenAI APIキーをAuthorizationヘッダーに含める", async () => {
    const scores = mockArticles.map((a) => ({ url: a.url, score: 5 }));
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOpenAIResponse(scores));
    vi.stubGlobal("fetch", mockFetch);

    await scoreStage1(mockArticles, "my-secret-key");

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer my-secret-key");
  });

  it("OpenAIレスポンスのJSONパース失敗時はエラーをスロー", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "invalid json {{{" } }],
        }),
      }),
    );

    await expect(scoreStage1(mockArticles, "test-api-key")).rejects.toThrow();
  });

  it("OpenAI APIがエラーを返した場合はエラーをスロー", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
      }),
    );

    await expect(scoreStage1(mockArticles, "test-api-key")).rejects.toThrow();
  });

  it("OpenAIレスポンスにないURLは除外される", async () => {
    const partialScores = [
      { url: "https://example.com/1", score: 8 },
      { url: "https://example.com/2", score: 6 },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(mockOpenAIResponse(partialScores)));

    const result = await scoreStage1(mockArticles, "test-api-key");

    expect(result).toHaveLength(2);
    expect(
      result.every((a) => ["https://example.com/1", "https://example.com/2"].includes(a.url)),
    ).toBe(true);
  });
});
