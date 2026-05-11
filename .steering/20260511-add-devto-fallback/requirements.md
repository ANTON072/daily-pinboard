# 要求内容: dev.to API を Pinboard のフォールバックとして追加

## 背景

Pinboard Popular フィード (`feeds.pinboard.in/json/popular/`) が断続的に 503 を返す。
Pinboard を引き続きメインソースとしつつ、失敗時のフォールバックとして dev.to API を利用する。

## 変更・追加する機能

`fetchFeed()` に以下の動作を追加する：

1. まず Pinboard Popular フィードの取得を試みる（既存のリトライロジックを維持）
2. すべてのリトライが失敗した場合、dev.to API にフォールバックして記事を取得する

## ユーザーストーリー

毎朝 JST 09:00 にメールが届く。
Pinboard が利用可能な日は Pinboard の人気記事が届く。
Pinboard が 503 などで取得できない日は dev.to の人気記事が届く。

## 受け入れ条件

- Pinboard の取得が全リトライ失敗した場合に dev.to API へフォールバックする
- dev.to はタグ絞り込みなしで直近 7 日間の人気記事を最大 50 件取得する（`top=7&per_page=50`）
- フォールバック時はログに「Falling back to dev.to」を出力する
- メール本文にフィードのソースを明記する（例: "Source: Pinboard" または "Source: dev.to"）
- `Article` 型（url / title / description / tags）は変更しない
- `PinboardItem` 型は維持する。`DevToArticle` 型を追加する
- 既存のテストと同等のカバレッジを維持し、フォールバック動作のテストを追加する

## 制約事項

- dev.to API は認証不要・無料（API キー不要）
- `Article` 型（url / title / description / tags）は変更しない
