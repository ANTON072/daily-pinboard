import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFeed } from "./fetcher";

const mockFeedData = [
  { u: "https://example.com/1", d: "Article 1", n: "Description 1", t: ["tag1", "tag2"] },
  { u: "https://example.com/2", d: "Article 2", n: "Description 2", t: ["tag3"] },
  { u: "https://example.com/3", d: "", n: "", t: [] },
];

const mockDevToData = [
  {
    url: "https://dev.to/1",
    title: "DevTo Article 1",
    description: "Dev desc 1",
    tag_list: ["js", "ts"],
  },
  { url: "https://dev.to/2", title: "DevTo Article 2", description: null, tag_list: ["css"] },
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

    const [{ articles, source }] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    expect(source).toBe("pinboard");
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

    const [{ articles }] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

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

    const [{ articles }] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(articles).toHaveLength(1);
  });

  it("Pinboard・dev.toともに配列以外を返した場合はエラーをスローする", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ error: "something went wrong" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ error: "something went wrong" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ error: "something went wrong" }) })
        // dev.to fallback also fails
        .mockResolvedValue({ ok: true, json: async () => ({ error: "something went wrong" }) }),
    );

    await expect(Promise.all([fetchFeed(), vi.runAllTimersAsync()])).rejects.toThrow(
      "Unexpected response format",
    );
  });

  it("全リトライ失敗後はdev.toにフォールバックする", async () => {
    const consoleSpy = vi.spyOn(console, "warn");
    const mockFetch = vi
      .fn()
      // Pinboard 3 attempts all fail
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      // dev.to succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevToData,
      });
    vi.stubGlobal("fetch", mockFetch);

    const [{ articles, source }] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    expect(source).toBe("devto");
    expect(articles).toHaveLength(2);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Pinboard all retries failed"),
      expect.anything(),
    );
  });

  it("全リトライ後もHTTPエラーの場合はdev.toにフォールバックする", async () => {
    const mockFetch = vi
      .fn()
      // Pinboard 3 attempts all return 503
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      // dev.to succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevToData,
      });
    vi.stubGlobal("fetch", mockFetch);

    const [{ source }] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    expect(source).toBe("devto");
  });

  it("dev.toレスポンスのArticle型マッピングを検証する", async () => {
    const mockFetch = vi
      .fn()
      // Pinboard fails
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      // dev.to succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDevToData,
      });
    vi.stubGlobal("fetch", mockFetch);

    const [{ articles }] = await Promise.all([fetchFeed(), vi.runAllTimersAsync()]);

    // tag_list → tags の変換
    expect(articles[0].tags).toEqual(["js", "ts"]);
    // description: null → "" の変換
    expect(articles[1].description).toBe("");
  });
});
