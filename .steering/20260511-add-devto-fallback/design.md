# 設計: dev.to API を Pinboard のフォールバックとして追加

## 実装アプローチ

Pinboard をメインソースとして維持しつつ、全リトライ失敗時のみ dev.to API にフォールバックする。
`fetchFeed()` の戻り値にソース情報を付加し、パイプライン末尾の `sendMail()` まで伝播させる。
`Article` 型は変更しない。

---

## 変更するファイル

### 1. `src/types.ts` — `DevToArticle` 型と `FeedSource` 型を追加

```ts
export type FeedSource = "pinboard" | "devto";

export interface DevToArticle {
  url: string;
  title: string;
  description: string | null;
  tag_list: string[];
}
```

`Article` / `PinboardItem` / その他の型は変更しない。

---

### 2. `src/fetcher.ts` — フォールバックロジックと戻り値の変更

#### 戻り値の変更

```ts
// 変更前
export async function fetchFeed(): Promise<Article[]>;

// 変更後
export async function fetchFeed(): Promise<{
  articles: Article[];
  source: FeedSource;
}>;
```

#### 追加する定数

```ts
const DEVTO_API_URL = "https://dev.to/api/articles?top=7&per_page=50";
```

#### フォールバックロジック（疑似コード）

```text
fetchFeed():
  既存のリトライループ（最大3回）を試みる
  → 成功: { articles: [...], source: "pinboard" } を返す
  → 全失敗: console.log("Falling back to dev.to") を出力
             fetchDevToFeed() を呼び出す
             { articles: [...], source: "devto" } を返す
```

`fetchDevToFeed()` も同じ `RETRY_DELAYS_MS`（5秒・10秒）でリトライする。全リトライ失敗時はエラーをスローする。

#### `DevToArticle` → `Article` のマッピング

| DevToArticle フィールド | Article フィールド | 備考                  |
| ----------------------- | ------------------ | --------------------- |
| `url`                   | `url`              | そのまま              |
| `title`                 | `title`            | そのまま              |
| `description`           | `description`      | `null` の場合は空文字 |
| `tag_list`              | `tags`             | `string[]`            |

---

### 3. `src/index.ts` — 戻り値の構造変更に対応

```ts
// 変更前
const raw = await fetchFeed();

// 変更後
const { articles: raw, source } = await fetchFeed();
```

`source` を `sendMail()` の第3引数として渡す。

---

### 4. `src/mailer.ts` — ソース表示の追加

```ts
// 変更前
export async function sendMail(
  articles: SummarizedArticle[],
  env: Env,
): Promise<void>;

// 変更後
export async function sendMail(
  articles: SummarizedArticle[],
  env: Env,
  source: FeedSource,
): Promise<void>;
```

`buildMailBody()` に `source` 引数を追加し、本文末尾に1行追加する：

```text
Source: Pinboard   ← source === "pinboard" の場合
Source: dev.to     ← source === "devto" の場合
```

---

## 影響範囲の分析

| ファイル         | 変更内容                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `src/types.ts`   | `FeedSource` 型・`DevToArticle` インターフェースを追加                                        |
| `src/fetcher.ts` | `fetchFeed()` 戻り値を `{ articles, source }` に変更、`fetchDevToFeed()` を内部関数として追加 |
| `src/index.ts`   | `fetchFeed()` 戻り値の分割代入、`sendMail()` に `source` を渡す                               |
| `src/mailer.ts`  | `sendMail()` に `source` 引数を追加、メール本文末尾にソース行を追加                           |

- `fetchFeed()` の呼び出し元は `index.ts` のみ → 影響範囲は限定的
- `sendMail()` の呼び出し元は `index.ts` のみ → 同上
- `Article` 型はパイプライン全体で使われるが変更しないため、下流（scorer / articleFetcher / summarizer）への影響なし

---

## テスト設計（`src/fetcher.test.ts` への追加）

追加するテストケース：

1. **Pinboard 成功時は `source` が `"pinboard"` であること**
   - 既存の成功テストに `source` アサーションを追加

2. **全リトライ失敗 → dev.to フォールバック成功**
   - Pinboard fetch を常に失敗させ、dev.to fetch を成功させる
   - `source === "devto"` であることを確認
   - ログに "Falling back to dev.to" が含まれることを確認（`vi.spyOn(console, "log")`）

3. **dev.to レスポンスが `Article` 型に正しくマッピングされること**
   - `tag_list` → `tags`、`description: null` → `""` の変換を検証

既存テストは `fetchFeed()` の戻り値を変更するため、
`const articles = await fetchFeed()` → `const { articles } = await fetchFeed()` に更新する。

---

## 非変更事項

- `Article` / `PinboardItem` 型の定義
- Pinboard のリトライロジック（`RETRY_DELAYS_MS`、遅延処理）
- `scorer` / `articleFetcher` / `summarizer` / `deduplicator`
