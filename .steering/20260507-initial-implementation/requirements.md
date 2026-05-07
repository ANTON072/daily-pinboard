# 初回実装 要求内容

## 概要

Daily Pinboard の初回実装。Pinboard パブリックフィードから毎朝9時（JST）に注目記事を自動収集・スコアリングし、日本語要約付きのメールを配信する Cloudflare Worker を構築する。

## ユーザーストーリー

- **自動配信：** 毎朝9時（JST）に何もしなくても注目記事のメールが届く
- **フロントエンド特化：** Webフロントエンド関連記事が優先的にピックアップされる
- **重複なし：** 過去に受け取った記事は再送されない
- **日本語要約：** 英語記事でも日本語の要約で内容が把握できる

## 実装する機能

### 1. 記事収集

- Pinboard Popular フィード（`https://feeds.pinboard.in/json/popular/`）から最大50件取得
- 取得失敗時は1回リトライ。再失敗時は処理中断・ログ記録

### 2. 第1段階スコアリング（事前フィルタリング）

- フィードの title / description を OpenAI GPT-4o-mini でバッチ評価
- Webフロントエンド関連度をスコアリング（0〜10）
- 上位20〜30件を候補として選出

### 3. 重複排除

- 候補記事のURLを D1 `sent_articles` テーブルと照合
- 過去90日間に送信済みの記事を除外
- 毎実行時に90日超過レコードを削除

### 4. 第2段階スコアリング（記事フェッチ＋最終選出）

- 候補記事のURLにアクセスし `<title>` / `<meta name="description">` / 本文（先頭3,000文字）を取得
- タイムアウト：5秒、失敗時は該当記事をスキップ
- メタ情報（title + description）を OpenAI GPT-4o-mini でバッチ評価し上位5件を選出

### 5. フォールバック補充

- フロントエンド関連記事が5件未満の場合、第1段階スコア降順で補充
- 補充後も5件未満なら取得できた件数で続行（0件の場合はスキップ）

### 6. 日本語要約生成

- 最終選出記事ごとに個別の OpenAI 呼び出し（最大5回）
- 入力：title + meta description + 本文テキスト（第2段階フェッチ結果を再利用）
- 出力：2〜3文の日本語要約

### 7. メール送信

- Resend API でプレーンテキストメールを送信
- 件名：`[Daily Pinboard] YYYY-MM-DD のフロントエンド記事`
- 送信元：`onboarding@resend.dev`、宛先：環境変数 `TO_EMAIL`

### 8. 送信済みURL記録

- Resend API 成功後に送信記事URLを D1 に記録

## 受け入れ条件

- `wrangler dev` でローカル動作確認ができること
- D1 マイグレーションが `wrangler d1 migrations apply` で適用できること
- `main` ブランチへの push で GitHub Actions が自動デプロイすること
- Biome の lint / format チェックが通ること（`npx biome check .`）
- TypeScript の型チェックが通ること（`tsc --noEmit`）

## 制約事項

- Cloudflare Workers Free プランのサブリクエスト上限（50件/呼び出し）を超えないこと
- 月額コスト $1 以下（OpenAI GPT-4o-mini のみ有料）
- APIキー類をソースコードにハードコードしないこと
- `any` 型を使用しないこと
