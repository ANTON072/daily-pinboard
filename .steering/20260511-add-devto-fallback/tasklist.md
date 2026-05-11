# タスクリスト: dev.to API を Pinboard のフォールバックとして追加

## タスク一覧

### 1. 型定義の追加 (`src/types.ts`)

- [x] `FeedSource` 型を追加（`"pinboard" | "devto"`）
- [x] `DevToArticle` インターフェースを追加（`url`, `title`, `description`, `tag_list` フィールド）

### 2. フェッチャーの変更 (`src/fetcher.ts`)

- [x] `fetchFeed()` の戻り値を `{ articles: Article[], source: FeedSource }` に変更
- [x] `DEVTO_API_URL` 定数を追加（`https://dev.to/api/articles?top=7&per_page=50`）
- [x] `fetchDevToFeed()` 内部関数を追加
  - [x] `RETRY_DELAYS_MS` を使った同一リトライロジックを実装
  - [x] `DevToArticle` → `Article` マッピング実装（`tag_list` → `tags`、`description: null` → `""`）
  - [x] 全リトライ失敗時はエラーをスロー
- [x] 既存のリトライループ全失敗時のフォールバック処理を追加
  - [x] `console.log("Falling back to dev.to")` を出力
  - [x] `fetchDevToFeed()` を呼び出し `source: "devto"` で返す
- [x] Pinboard 成功時は `source: "pinboard"` で返す

### 3. エントリポイントの変更 (`src/index.ts`)

- [x] `fetchFeed()` の戻り値を分割代入に変更（`const { articles: raw, source } = await fetchFeed()`）
- [x] `sendMail()` の第3引数に `source` を渡す

### 4. メーラーの変更 (`src/mailer.ts`)

- [x] `sendMail()` のシグネチャに `source: FeedSource` を第3引数として追加
- [x] `buildMailBody()` に `source` 引数を追加
- [x] メール本文末尾にソース行を追加（`Source: Pinboard` または `Source: dev.to`）

### 5. テストの更新・追加 (`src/fetcher.test.ts`)

- [x] 既存テストの `fetchFeed()` 呼び出しを分割代入に更新（`const { articles } = await fetchFeed()`）
- [x] 既存の成功テストに `source === "pinboard"` のアサーションを追加
- [x] テスト追加: 全リトライ失敗 → dev.to フォールバック成功
  - [x] Pinboard fetch を常に失敗させる
  - [x] dev.to fetch を成功させる
  - [x] `source === "devto"` を確認
  - [x] ログに "Falling back to dev.to" が含まれることを確認（`vi.spyOn(console, "log")`）
- [x] テスト追加: dev.to レスポンスの `Article` 型マッピング検証
  - [x] `tag_list` → `tags` の変換を検証
  - [x] `description: null` → `""` の変換を検証

### 6. 品質チェック

- [x] lint・型チェックを実行して問題がないことを確認
- [x] 全テストが通ることを確認

## 完了条件

- Pinboard 全リトライ失敗時に dev.to へフォールバックする
- フォールバック時のログ出力が機能する
- メール本文にソース情報が表示される
- `Article` 型に変更がない
- 全テストが通る
