import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMail } from "./mailer";
import type { Env, SummarizedArticle } from "./types";

const mockArticles: SummarizedArticle[] = [
  {
    url: "https://example.com/article1",
    title: "Article 1",
    description: "Description 1",
    tags: ["javascript", "react"],
    score: 9,
    fetchedTitle: "Fetched Title 1",
    fetchedDescription: "Fetched Description 1",
    bodyText: "Body text 1",
    summary: "これは記事1の日本語要約です。フロントエンドに関する重要な内容が含まれています。",
  },
  {
    url: "https://example.com/article2",
    title: "Article 2",
    description: "Description 2",
    tags: ["typescript"],
    score: 8,
    fetchedTitle: "Fetched Title 2",
    fetchedDescription: "Fetched Description 2",
    bodyText: "Body text 2",
    summary: "これは記事2の日本語要約です。TypeScriptに関するベストプラクティスです。",
  },
];

const mockEnv: Env = {
  DB: {} as D1Database,
  OPENAI_API_KEY: "test-openai-key",
  RESEND_API_KEY: "test-resend-key",
  TO_EMAIL: "test@example.com",
};

describe("sendMail", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email-id-123" }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Resend API を1回呼び出す", async () => {
    await sendMail(mockArticles, mockEnv);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("正しいエンドポイントとヘッダーで呼び出す", async () => {
    await sendMail(mockArticles, mockEnv);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-resend-key",
        }),
      }),
    );
  });

  it("件名に今日の日付を含む", async () => {
    await sendMail(mockArticles, mockEnv);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);

    expect(body.subject).toMatch(/\[Daily Pinboard\] \d{4}-\d{2}-\d{2} のフロントエンド記事/);
  });

  it("宛先メールアドレスを正しく設定する", async () => {
    await sendMail(mockArticles, mockEnv);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);

    expect(body.to).toContain("test@example.com");
  });

  it("本文にすべての記事URLを含む", async () => {
    await sendMail(mockArticles, mockEnv);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);

    expect(body.text).toContain("https://example.com/article1");
    expect(body.text).toContain("https://example.com/article2");
  });

  it("本文にすべての記事タイトルを含む", async () => {
    await sendMail(mockArticles, mockEnv);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);

    expect(body.text).toContain("Fetched Title 1");
    expect(body.text).toContain("Fetched Title 2");
  });

  it("本文にすべての要約を含む", async () => {
    await sendMail(mockArticles, mockEnv);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);

    expect(body.text).toContain("これは記事1の日本語要約です");
    expect(body.text).toContain("これは記事2の日本語要約です");
  });

  it("fetchedTitle が空の場合は title にフォールバックする", async () => {
    const articlesWithEmptyFetchedTitle: SummarizedArticle[] = [
      { ...mockArticles[0], fetchedTitle: "" },
    ];
    await sendMail(articlesWithEmptyFetchedTitle, mockEnv);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);

    expect(body.text).toContain("Article 1");
  });

  it("Resend API がエラーを返した場合に例外をスローする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
      }),
    );

    await expect(sendMail(mockArticles, mockEnv)).rejects.toThrow("Resend API error: 422");
  });
});
