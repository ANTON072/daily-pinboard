import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupExpiredRecords, deduplicateArticles, recordSentArticles } from "./deduplicator";
import type { ScoredArticle } from "./types";

const makeArticle = (url: string): ScoredArticle => ({
  url,
  title: `Title ${url}`,
  description: `Desc ${url}`,
  tags: [],
  score: 5,
});

function makeD1Mock(overrides: Record<string, unknown> = {}) {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
    raw: vi.fn().mockResolvedValue([]),
  };
  return {
    prepare: vi.fn().mockReturnValue({ ...statement, ...overrides }),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0 }),
  } as unknown as D1Database;
}

describe("deduplicateArticles", () => {
  it("D1に存在しないURLのみ返す", async () => {
    const articles = [
      makeArticle("https://example.com/new"),
      makeArticle("https://example.com/sent"),
    ];

    const statement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      raw: vi.fn().mockResolvedValue([]),
      all: vi.fn(),
    };
    statement.all.mockResolvedValueOnce({ results: [{ url: "https://example.com/sent" }] });

    const db = {
      prepare: vi.fn().mockReturnValue(statement),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn(),
    } as unknown as D1Database;

    const result = await deduplicateArticles(articles, db);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/new");
  });

  it("全記事が未送信の場合は全件返す", async () => {
    const articles = [makeArticle("https://a.com"), makeArticle("https://b.com")];

    const statement = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      raw: vi.fn().mockResolvedValue([]),
    };
    const db = {
      prepare: vi.fn().mockReturnValue(statement),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn(),
    } as unknown as D1Database;

    const result = await deduplicateArticles(articles, db);

    expect(result).toHaveLength(2);
  });

  it("空配列を渡すと空配列を返す", async () => {
    const db = makeD1Mock();
    const result = await deduplicateArticles([], db);
    expect(result).toHaveLength(0);
  });
});

describe("cleanupExpiredRecords", () => {
  it("90日超過レコードを削除するSQLを実行する", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      raw: vi.fn().mockResolvedValue([]),
    };
    const db = {
      prepare: vi.fn().mockReturnValue(statement),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn(),
    } as unknown as D1Database;

    await cleanupExpiredRecords(db);

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM sent_articles"));
    expect(statement.bind).toHaveBeenCalledWith(expect.any(String));
    expect(statement.run).toHaveBeenCalled();
  });
});

describe("recordSentArticles", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("送信済みURLをD1に記録する", async () => {
    const urls = ["https://example.com/1", "https://example.com/2"];

    const statement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      raw: vi.fn().mockResolvedValue([]),
    };
    const db = {
      prepare: vi.fn().mockReturnValue(statement),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn(),
    } as unknown as D1Database;

    await recordSentArticles(urls, db);

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO sent_articles"));
    expect(statement.bind).toHaveBeenCalledTimes(2);
  });

  it("空配列を渡した場合はD1を呼ばない", async () => {
    const db = makeD1Mock();
    await recordSentArticles([], db);
    expect(db.prepare).not.toHaveBeenCalled();
  });
});
