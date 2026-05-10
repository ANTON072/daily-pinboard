import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFeed } from "./fetcher";

const mockFeedData = [
  { u: "https://example.com/1", d: "Article 1", n: "Description 1", t: ["tag1", "tag2"] },
  { u: "https://example.com/2", d: "Article 2", n: "Description 2", t: ["tag3"] },
  { u: "https://example.com/3", d: "", n: "", t: [] },
];

describe("fetchFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("フィードを取得してArticle配列に変換する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeedData,
      }),
    );

    const [articles] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    expect(articles).toHaveLength(3);
    expect(articles[0]).toEqual({
      url: "https://example.com/1",
      title: "Article 1",
      description: "Description 1",
      tags: ["tag1", "tag2"],
    });
    expect(articles[2]).toEqual({
      url: "https://example.com/3",
      title: "",
      description: "",
      tags: [],
    });
  });

  it("503エラー後に待機してリトライし成功する", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockFeedData[0]],
      });
    vi.stubGlobal("fetch", mockFetch);

    const [articles] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(articles).toHaveLength(1);
  });

  it("JSONパースエラー後に待機してリトライし成功する", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockFeedData[0]],
      });
    vi.stubGlobal("fetch", mockFetch);

    const [articles] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(articles).toHaveLength(1);
  });

  it("配列以外のレスポンスはエラーをスローする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: "something went wrong" }),
      }),
    );

    await expect(Promise.all([fetchFeed(), vi.runAllTimersAsync()])).rejects.toThrow(
      "Unexpected response format",
    );
  });

  it("全リトライ失敗後はエラーをスローする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    await expect(Promise.all([fetchFeed(), vi.runAllTimersAsync()])).rejects.toThrow(
      "Network error",
    );
  });

  it("全リトライ後もHTTPエラーの場合はエラーをスローする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(Promise.all([fetchFeed(), vi.runAllTimersAsync()])).rejects.toThrow(
      "HTTP error: 503",
    );
  });
});
