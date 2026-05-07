# 開発ガイドライン

## コーディング規約

### 基本方針

- TypeScript の strict モードを有効にする
- `any` 型の使用を禁止する。型が不明な場合は `unknown` を使う
- 型アサーション（`as`）は原則禁止。型ガードや型絞り込みで対応する
- 非同期処理は `async/await` を使い、`.then()/.catch()` チェーンは避ける
- エラーハンドリングは呼び出し元で行い、関数内でのサイレント握り潰しを避ける

### 命名規則

| 対象                 | 規則             | 例                            |
| -------------------- | ---------------- | ----------------------------- |
| 変数・関数           | camelCase        | `scoredArticles`, `fetchFeed` |
| 型・インターフェース | PascalCase       | `Article`, `ScoredArticle`    |
| 定数                 | UPPER_SNAKE_CASE | `MAX_ARTICLES`                |
| ファイル名           | camelCase        | `pinboardFetcher.ts`          |

### コメント

- コードから自明な内容はコメントしない
- 外部 API の仕様上の制約や非自明な挙動にのみコメントを付ける

---

## Biome（Lint / Format）

### セットアップ

```bash
npm install --save-dev --save-exact @biomejs/biome
npx biome init
```

### 主要コマンド

```bash
npx biome check .                   # lint + format チェック
npx biome check --write --assist .  # 自動修正（import 整理含む）
```

### `biome.json` 基本設定

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

### CI での実行

`npx biome check .` が失敗した場合はデプロイをブロックする。

---

## Git 規約

### ブランチ戦略

- `main` ブランチが本番環境に対応する
- 機能追加・修正は `main` から作業ブランチを切って実装する
- 作業ブランチ名：`[種別]/[概要]`（例：`feat/add-scoring`, `fix/dedup-query`）

### コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) に従う。

```
<type>: <概要>
```

| type       | 用途                         |
| ---------- | ---------------------------- |
| `feat`     | 新機能                       |
| `fix`      | バグ修正                     |
| `chore`    | ビルド・設定変更             |
| `docs`     | ドキュメント更新             |
| `refactor` | 動作変更を伴わないコード整理 |
| `test`     | テストの追加・修正           |

---

## テスト規約

### 方針：テスト駆動開発（TDD）

本プロジェクトはテスト駆動開発を採用する。実装前にテストを書き、Red → Green → Refactor のサイクルを繰り返す。

1. **Red：** 失敗するテストを書く（実装なし・仕様の明文化）
2. **Green：** テストが通る最小限の実装を書く
3. **Refactor：** テストを通したまま実装を整理する

### テストフレームワーク

- **Vitest** を使用する
- テストファイルはソースファイルと同じディレクトリに配置する（コロケーション）
- ファイル名：`[対象ファイル名].test.ts`（例：`fetcher.test.ts`）

### テスト対象の原則

すべてのビジネスロジック関数にテストを書く。

| ファイル | テスト対象関数 |
| --- | --- |
| `fetcher.ts` | `fetchFeed` のパース・リトライロジック |
| `scorer.ts` | `scoreStage1`・`scoreStage2` のスコア選出ロジック |
| `deduplicator.ts` | `deduplicateArticles`・`cleanupExpiredRecords`・`recordSentArticles` |
| `articleFetcher.ts` | HTML パース・本文抽出ロジック |
| `summarizer.ts` | `summarizeArticles` の入出力マッピング |
| `mailer.ts` | メール本文フォーマット生成ロジック |

外部サービス（OpenAI・Resend・Pinboard・D1）はモックまたはスタブで差し替える。

### 主要コマンド

```bash
npm test                  # テスト実行（CI 向け）
npm run test:watch        # ウォッチモード（開発中）
npm run test:coverage     # カバレッジレポート出力
```

### テスト実行タイミング

- 実装前：テストを書いて失敗することを確認（Red）
- 実装後：すべてのテストが通ることを確認（Green）
- CI：`main` へのプッシュ時に自動実行し、失敗時はデプロイをブロック

### ローカル動作確認

```bash
npm run dev               # wrangler dev 起動
npm run db:migrate:local  # D1 マイグレーション（ローカル）
```

---

## デプロイ

- `main` ブランチへの push で GitHub Actions が自動デプロイする
- 手動デプロイ：`npm run deploy`
- デプロイ前に `biome check .` と型チェック（`tsc --noEmit`）を通すこと

### 必要な GitHub Secrets

| シークレット名          | 説明                     |
| ----------------------- | ------------------------ |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API トークン  |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |
