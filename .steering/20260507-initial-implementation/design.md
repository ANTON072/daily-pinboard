# 初回実装 設計

## 実装アプローチ

単一の Cloudflare Worker として実装する。処理フェーズごとにファイルを分割し、`src/index.ts` がエントリポイントとして各フェーズを順次呼び出す。

## ファイル構成

```
src/
├── index.ts          # Worker エントリポイント・処理フロー制御
├── types.ts          # 共有型定義
├── fetcher.ts        # 記事収集（Pinboard フィード取得）
├── scorer.ts         # 第1・第2段階スコアリング
├── deduplicator.ts   # 重複排除・D1 操作
├── articleFetcher.ts # 記事URL フェッチ（メタ情報・本文取得）
├── summarizer.ts     # 日本語要約生成
└── mailer.ts         # メール送信（Resend）

migrations/
└── 0001_create_sent_articles.sql

.github/
└── workflows/
    └── deploy.yml

wrangler.toml
tsconfig.json
biome.json
```

## 型定義（`src/types.ts`）

```typescript
// Pinboard フィードの生レスポンス
interface PinboardItem {
  u: string   // URL
  d: string   // title
  n: string   // description
  t: string[] // tags
}

// アプリ内の記事オブジェクト
interface Article {
  url: string
  title: string
  description: string
  tags: string[]
}

// 第1段階スコアリング後
interface ScoredArticle extends Article {
  score: number
}

// 第2段階フェッチ後
interface FetchedArticle extends ScoredArticle {
  fetchedTitle: string
  fetchedDescription: string
  bodyText: string
}

// 最終選出・要約済み
interface SummarizedArticle extends FetchedArticle {
  summary: string
}

// Cloudflare Workers 環境変数
interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  RESEND_API_KEY: string
  TO_EMAIL: string
}
```

## 各ファイルの責務と主要関数

### `src/index.ts`

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>
}
```

処理フロー：
1. `fetchFeed()` → 記事リスト（50件）
2. `scoreStage1()` → スコア付き記事（上位20〜30件）
3. `deduplicateArticles()` → 重複排除後の候補
4. `cleanupExpiredRecords()` → 90日超過レコード削除
5. `fetchArticles()` → フェッチ済み記事
6. `scoreStage2()` → 最終候補（上位5件）
7. フォールバック補充（必要な場合）
8. `summarizeArticles()` → 要約付き記事
9. `sendMail()` → メール送信
10. `recordSentArticles()` → D1 記録

### `src/fetcher.ts`

```typescript
async function fetchFeed(): Promise<Article[]>
```

- `https://feeds.pinboard.in/json/popular/` に GET
- 失敗時は1回リトライ（`retryFetch` ヘルパー）
- PinboardItem → Article に変換

### `src/scorer.ts`

```typescript
async function scoreStage1(articles: Article[], apiKey: string): Promise<ScoredArticle[]>
async function scoreStage2(articles: FetchedArticle[], apiKey: string): Promise<FetchedArticle[]>
```

- 第1段階：全記事を一括送信。スコア（0〜10）付きリストを返す
- 第2段階：fetchedTitle + fetchedDescription を一括送信。スコア上位5件を返す
- OpenAI レスポンスは JSON モードで受け取り、パース失敗時はエラーをスロー

### `src/articleFetcher.ts`

```typescript
async function fetchArticles(articles: ScoredArticle[]): Promise<FetchedArticle[]>
```

- 各URLに fetch（タイムアウト5秒）
- `<article>` → `<main>` → `<body>` の優先順位で本文抽出、先頭3,000文字に切り詰め
- 失敗時はスキップ（`console.error` でログ記録）

### `src/deduplicator.ts`

```typescript
async function deduplicateArticles(articles: ScoredArticle[], db: D1Database): Promise<ScoredArticle[]>
async function recordSentArticles(articles: SummarizedArticle[], db: D1Database): Promise<void>
async function cleanupExpiredRecords(db: D1Database): Promise<void>
```

### `src/summarizer.ts`

```typescript
async function summarizeArticles(articles: FetchedArticle[], apiKey: string): Promise<SummarizedArticle[]>
```

- 記事ごとに個別 OpenAI 呼び出し（最大5回）
- 入力：title + fetchedDescription + bodyText
- 出力：2〜3文の日本語要約

### `src/mailer.ts`

```typescript
async function sendMail(articles: SummarizedArticle[], env: Env): Promise<void>
```

- Resend API（`https://api.resend.com/emails`）に POST
- 件名：`[Daily Pinboard] YYYY-MM-DD のフロントエンド記事`
- 本文：プレーンテキスト形式

## 設定ファイル

### `wrangler.toml`

```toml
name = "daily-pinboard"
main = "src/index.ts"
compatibility_date = "2025-11-01"

[[d1_databases]]
binding = "DB"
database_name = "daily-pinboard"
database_id = "<D1_DATABASE_ID>"  # wrangler d1 create 後に設定

[triggers]
crons = ["0 0 * * *"]  # UTC 00:00 = JST 09:00
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

### `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.0/schema.json",
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

## D1 マイグレーション

### `migrations/0001_create_sent_articles.sql`

```sql
CREATE TABLE sent_articles (
  url     TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
```

## GitHub Actions（`.github/workflows/deploy.yml`）

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - run: npx biome check .
      - run: npx tsc --noEmit
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## 環境変数管理

| 環境       | 管理方法                          |
| ---------- | --------------------------------- |
| ローカル   | `.env.local`（`.gitignore` 対象） |
| 本番       | `wrangler secret put <KEY>`       |
| CI/CD      | GitHub Secrets                    |

## 影響範囲

- 新規ファイルのみ作成。既存ファイルへの変更なし
- `package.json` に devDependencies 追加（`@cloudflare/workers-types`, `@biomejs/biome`, `typescript`）
- `package.json` の `scripts` に `dev`, `deploy`, `db:migrate:local`, `db:migrate:remote`, `typecheck`, `lint` を追加
