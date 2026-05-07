import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFeed } from "./fetcher";

const mockFeedData = [
  { u: "https://example.com/1", d: "Article 1", n: "Description 1", t: ["tag1", "tag2"] },
  { u: "https://example.com/2", d: "Article 2", n: "Description 2", t: ["tag3"] },
  { u: "https://example.com/3", d: "", n: "", t: [] },
];

describe("fetchFeed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("フィードを取得してArticle配列に変換する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeedData,
      }),
    );

    const articles = await fetchFeed();

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

  it("fetch失敗時に1回リトライして成功する", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockFeedData[0]],
      });
    vi.stubGlobal("fetch", mockFetch);

    const articles = await fetchFeed();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(articles).toHaveLength(1);
  });

  it("HTTPエラー時に1回リトライして成功する", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockFeedData[0]],
      });
    vi.stubGlobal("fetch", mockFetch);

    const articles = await fetchFeed();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(articles).toHaveLength(1);
  });

  it("リトライも失敗した場合はエラーをスローする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    await expect(fetchFeed()).rejects.toThrow();
  });

  it("リトライ後もHTTPエラーの場合はエラーをスローする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(fetchFeed()).rejects.toThrow();
  });
});
