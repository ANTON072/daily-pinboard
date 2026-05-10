# タスクリスト：Pinboard JSON API フェッチエラーの修正

## タスク

- [x] `src/fetcher.ts` を修正する
  - `retryFetch` と `fetchFeed` を統合し、リトライ間の `sleep` を追加
  - `res.json()` のパース失敗をリトライ対象に含める
  - パース後のデータが配列であることを検証する

- [x] `src/fetcher.test.ts` を更新する
  - `vi.useFakeTimers()` で `sleep` をスキップ
  - 503 → 待機 → 成功のテストケースを追加
  - JSON パースエラー → 待機 → 成功のテストケースを追加
  - 非配列レスポンス → エラースローのテストケースを追加
  - 既存テストがすべて通過することを確認

- [x] lint・型チェックを実施する
  - `pnpm run check`（または該当するコマンド）でエラーがないことを確認
