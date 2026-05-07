# リポジトリ構造定義書

## ディレクトリ構成

```text
daily-pinboard/
├── src/              # TypeScript ソースコード
├── migrations/       # D1 スキーママイグレーション
├── .github/
│   └── workflows/    # GitHub Actions ワークフロー
├── docs/             # 永続的ドキュメント
├── .steering/        # 作業単位のドキュメント
├── wrangler.toml
├── package.json
├── tsconfig.json
├── .gitignore
└── CLAUDE.md
```

> このツリーはトップレベルの構造のみを示す。`src/` 以下のファイル構成はコードベースが正とし、このドキュメントでは管理しない。

---

## ディレクトリの役割

| ディレクトリ | 役割 |
| --- | --- |
| `src/` | アプリケーションの TypeScript ソースコード一式 |
| `migrations/` | D1 スキーママイグレーション SQL ファイル（連番管理） |
| `.github/workflows/` | `main` push 時の自動デプロイワークフロー |
| `docs/` | アプリケーション全体の設計を定義する永続的ドキュメント |
| `.steering/` | 作業ごとの要求・設計・タスクを記録するドキュメント |

---

## ファイル配置ルール

### ソースコード（`src/`）

- すべての TypeScript ファイルは `src/` 以下に配置する
- Worker エントリポイントは `src/index.ts` に固定する
- 1ファイル＝1処理フェーズの責務とし、ファイル名はその責務を表す名詞にする
  - 例：`fetcher.ts`（記事収集）、`scorer.ts`（スコアリング）、`mailer.ts`（メール送信）
- 複数ファイル間で共有する型定義は `src/types.ts` にまとめる
- 処理フェーズが増えた場合は上記の命名方針に従い新ファイルを追加する

### テストファイル（`src/*.test.ts`）

- テストファイルはソースファイルと同じ `src/` 内にコロケーション（同居）させる
- ファイル名：`[対象ファイル名].test.ts`（例：`fetcher.test.ts`）
- テストは実装ファイルよりも **先に** 作成する（TDD）

### マイグレーション（`migrations/`）

- ファイル名は `[連番]_[説明].sql` の形式とする（例：`0001_create_sent_articles.sql`）
- 一度適用したファイルは変更しない。変更が必要な場合は新しいファイルを追加する

### 設定ファイル

- `wrangler.toml`、`package.json`、`tsconfig.json` はリポジトリルートに置く
- 環境変数・シークレットはソースコードに記述しない
  - ローカル開発：`.dev.vars`（`.gitignore` 対象）
  - 本番：Cloudflare Workers のシークレット管理機能を使用

### `.gitignore` の対象

```text
node_modules/
dist/
.wrangler/
.dev.vars
```

### エディタ設定（`.vscode/` など）

- `.vscode/settings.json` はリポジトリに含めてチームで共有する
- 個人の好みに依存する設定（フォントサイズ等）は `.vscode/` に置かず各自のユーザー設定で管理する

---

## 主要設定ファイル

### `wrangler.toml`

```toml
name = "daily-pinboard"
main = "src/index.ts"
compatibility_date = "YYYY-MM-DD"  # wrangler が推奨する最新日付を使用

[[d1_databases]]
binding = "DB"
database_name = "daily-pinboard"
database_id = "<D1_DATABASE_ID>"

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

### `package.json`（主要スクリプト）

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "db:migrate:local": "wrangler d1 migrations apply daily-pinboard --local",
    "db:migrate:remote": "wrangler d1 migrations apply daily-pinboard --remote"
  }
}
```
