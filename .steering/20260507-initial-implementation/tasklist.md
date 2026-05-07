# 初回実装 タスクリスト

## ステータス凡例

- `[ ]` 未着手
- `[x]` 完了

---

## フェーズ1：環境セットアップ

- [ ] 1-1. Cloudflare D1 データベース作成（`wrangler d1 create daily-pinboard`）
- [ ] 1-2. `wrangler.toml` 作成（D1 database_id を設定）
- [ ] 1-3. `tsconfig.json` 作成
- [ ] 1-4. devDependencies 追加（`@cloudflare/workers-types`, `@biomejs/biome`, `typescript`）
- [ ] 1-5. `package.json` の `scripts` 更新（`dev`, `deploy`, `db:migrate:local`, `db:migrate:remote`, `typecheck`, `lint`）
- [ ] 1-6. `biome.json` 作成
- [ ] 1-7. `.env.local` に Cloudflare D1 database_id を追記（ローカル開発用変数の確認）

## フェーズ2：D1 マイグレーション

- [ ] 2-1. `migrations/0001_create_sent_articles.sql` 作成
- [ ] 2-2. ローカル D1 にマイグレーション適用（`npm run db:migrate:local`）

## フェーズ3：型定義

- [ ] 3-1. `src/types.ts` 作成（`Article`, `ScoredArticle`, `FetchedArticle`, `SummarizedArticle`, `Env`）

## フェーズ4：記事収集（`src/fetcher.ts`）

- [ ] 4-1. `fetchFeed()` 実装（Pinboard Popular フィード取得）
- [ ] 4-2. リトライロジック実装（失敗時1回リトライ）

## フェーズ5：第1段階スコアリング（`src/scorer.ts`）

- [ ] 5-1. `scoreStage1()` 実装（title / description を一括送信・スコアリング）
- [ ] 5-2. OpenAI レスポンスのパース・上位20〜30件の選出ロジック実装

## フェーズ6：重複排除（`src/deduplicator.ts`）

- [ ] 6-1. `deduplicateArticles()` 実装（D1 照合・除外）
- [ ] 6-2. `cleanupExpiredRecords()` 実装（90日超過レコード削除）
- [ ] 6-3. `recordSentArticles()` 実装（送信済みURL記録）

## フェーズ7：記事フェッチ（`src/articleFetcher.ts`）

- [ ] 7-1. `fetchArticles()` 実装（タイムアウト5秒、失敗時スキップ）
- [ ] 7-2. HTML パース実装（`<article>` → `<main>` → `<body>` 優先順位・先頭3,000文字）

## フェーズ8：第2段階スコアリング（`src/scorer.ts`）

- [ ] 8-1. `scoreStage2()` 実装（fetchedTitle + fetchedDescription 一括送信・上位5件選出）
- [ ] 8-2. フォールバック補充ロジック実装（5件未満時に第1段階スコア降順で補充）

## フェーズ9：日本語要約生成（`src/summarizer.ts`）

- [ ] 9-1. `summarizeArticles()` 実装（記事ごと個別 OpenAI 呼び出し・日本語要約生成）

## フェーズ10：メール送信（`src/mailer.ts`）

- [ ] 10-1. `sendMail()` 実装（Resend API でプレーンテキストメール送信）
- [ ] 10-2. メール本文フォーマット実装

## フェーズ11：エントリポイント（`src/index.ts`）

- [ ] 11-1. `scheduled` ハンドラ実装（各フェーズを順次呼び出し）
- [ ] 11-2. エラーハンドリング・ログ出力の整備

## フェーズ12：品質チェック

- [ ] 12-1. Biome lint / format チェック（`npm run lint`）
- [ ] 12-2. TypeScript 型チェック（`npm run typecheck`）
- [ ] 12-3. `wrangler dev` でローカル動作確認

## フェーズ13：デプロイ準備

- [ ] 13-1. `.github/workflows/deploy.yml` 作成
- [ ] 13-2. Cloudflare Workers にシークレット登録（`wrangler secret put OPENAI_API_KEY` 等）
- [ ] 13-3. リモート D1 にマイグレーション適用（`npm run db:migrate:remote`）
- [ ] 13-4. GitHub Secrets に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を登録
- [ ] 13-5. `main` ブランチへ push して GitHub Actions の自動デプロイを確認
