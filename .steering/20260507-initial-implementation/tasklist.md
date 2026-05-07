# 初回実装 タスクリスト

## ステータス凡例

- `[ ]` 未着手
- `[x]` 完了

---

## フェーズ1：環境セットアップ

- [x] 1-1. Cloudflare D1 データベース作成（`wrangler d1 create daily-pinboard`）
- [x] 1-2. `wrangler.toml` 作成（D1 database_id を設定）
- [x] 1-3. `tsconfig.json` 作成
- [x] 1-4. devDependencies 追加（`@cloudflare/workers-types`, `@biomejs/biome`, `typescript`）
- [x] 1-5. `package.json` の `scripts` 更新（`dev`, `deploy`, `db:migrate:local`, `db:migrate:remote`, `typecheck`, `lint`）
- [x] 1-6. `biome.json` 作成
- [x] 1-7. `.env.local` に Cloudflare D1 database_id を追記（ローカル開発用変数の確認）

## フェーズ2：D1 マイグレーション

- [x] 2-1. `migrations/0001_create_sent_articles.sql` 作成
- [x] 2-2. ローカル D1 にマイグレーション適用（`pnpm run db:migrate:local`）

## フェーズ3：型定義

- [x] 3-1. `src/types.ts` 作成（`Article`, `ScoredArticle`, `FetchedArticle`, `SummarizedArticle`, `Env`）

## フェーズ4：テスト環境セットアップ

- [x] 4-1. `vitest` を devDependencies に追加
- [x] 4-2. `vitest.config.ts` 作成
- [x] 4-3. `package.json` の `scripts` に `test` / `test:watch` / `test:coverage` を追加

## フェーズ5：記事収集（`src/fetcher.ts`） ※TDD

- [x] 5-1. **[Red]** `src/fetcher.test.ts` 作成（フィードパース・リトライロジックのテストを書く）
- [x] 5-2. **[Green]** `fetchFeed()` 実装（Pinboard Popular フィード取得）
- [x] 5-3. **[Green]** リトライロジック実装（失敗時1回リトライ）
- [x] 5-4. `pnpm test` でテストが通ることを確認

## フェーズ6：第1段階スコアリング（`src/scorer.ts`） ※TDD

- [ ] 6-1. **[Red]** `src/scorer.test.ts` 作成（スコア選出ロジック・OpenAI レスポンスパースのテストを書く）
- [ ] 6-2. **[Green]** `scoreStage1()` 実装（title / description を一括送信・スコアリング）
- [ ] 6-3. **[Green]** OpenAI レスポンスのパース・上位20〜30件の選出ロジック実装
- [ ] 6-4. `pnpm test` でテストが通ることを確認

## フェーズ7：重複排除（`src/deduplicator.ts`） ※TDD

- [ ] 7-1. **[Red]** `src/deduplicator.test.ts` 作成（D1 照合・期限切れ削除・URL記録のテストを書く）
- [ ] 7-2. **[Green]** `deduplicateArticles()` 実装（D1 照合・除外）
- [ ] 7-3. **[Green]** `cleanupExpiredRecords()` 実装（90日超過レコード削除）
- [ ] 7-4. **[Green]** `recordSentArticles()` 実装（送信済みURL記録）
- [ ] 7-5. `pnpm test` でテストが通ることを確認

## フェーズ8：記事フェッチ（`src/articleFetcher.ts`） ※TDD

- [ ] 8-1. **[Red]** `src/articleFetcher.test.ts` 作成（HTML パース・本文抽出・タイムアウト処理のテストを書く）
- [ ] 8-2. **[Green]** `fetchArticles()` 実装（タイムアウト5秒、失敗時スキップ）
- [ ] 8-3. **[Green]** HTML パース実装（`<article>` → `<main>` → `<body>` 優先順位・先頭3,000文字）
- [ ] 8-4. `pnpm test` でテストが通ることを確認

## フェーズ9：第2段階スコアリング（`src/scorer.ts`） ※TDD

- [ ] 9-1. **[Red]** `scorer.test.ts` に `scoreStage2` のテストを追加（フォールバック補充ロジック含む）
- [ ] 9-2. **[Green]** `scoreStage2()` 実装（fetchedTitle + fetchedDescription 一括送信・上位5件選出）
- [ ] 9-3. **[Green]** フォールバック補充ロジック実装（5件未満時に第1段階スコア降順で補充）
- [ ] 9-4. `pnpm test` でテストが通ることを確認

## フェーズ10：日本語要約生成（`src/summarizer.ts`） ※TDD

- [ ] 10-1. **[Red]** `src/summarizer.test.ts` 作成（入出力マッピング・OpenAI 呼び出し回数のテストを書く）
- [ ] 10-2. **[Green]** `summarizeArticles()` 実装（記事ごと個別 OpenAI 呼び出し・日本語要約生成）
- [ ] 10-3. `pnpm test` でテストが通ることを確認

## フェーズ11：メール送信（`src/mailer.ts`） ※TDD

- [ ] 11-1. **[Red]** `src/mailer.test.ts` 作成（メール本文フォーマット・Resend 呼び出しのテストを書く）
- [ ] 11-2. **[Green]** `sendMail()` 実装（Resend API でプレーンテキストメール送信）
- [ ] 11-3. **[Green]** メール本文フォーマット実装
- [ ] 11-4. `pnpm test` でテストが通ることを確認

## フェーズ12：エントリポイント（`src/index.ts`）

- [ ] 12-1. `scheduled` ハンドラ実装（各フェーズを順次呼び出し）
- [ ] 12-2. エラーハンドリング・ログ出力の整備

## フェーズ13：品質チェック

- [ ] 13-1. `npm test` ですべてのテストが通ることを確認
- [ ] 13-2. Biome lint / format チェック（`pnpm run lint`）
- [ ] 13-3. TypeScript 型チェック（`pnpm run typecheck`）
- [ ] 13-4. `wrangler dev` でローカル動作確認

## フェーズ14：デプロイ準備

- [ ] 14-1. `.github/workflows/deploy.yml` 作成（CI に `pnpm test` を追加）
- [ ] 14-2. Cloudflare Workers にシークレット登録（`wrangler secret put OPENAI_API_KEY` 等）
- [ ] 14-3. リモート D1 にマイグレーション適用（`pnpm run db:migrate:remote`）
- [ ] 14-4. GitHub Secrets に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を登録
- [ ] 14-5. `main` ブランチへ push して GitHub Actions の自動デプロイを確認
