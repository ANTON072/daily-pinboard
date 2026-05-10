# 設計：Pinboard JSON API フェッチエラーの修正

## 実装アプローチ

`retryFetch` を `fetchWithRetry` として再設計し、以下の 3 点を解決する。

1. リトライ間にエクスポネンシャルバックオフの待機を追加（主因への対処）
2. `res.json()` のパース失敗もリトライ対象に含める
3. パース後のデータが配列であることを検証する

### 待機時間の設計

| 試行回数     | 待機（秒） |
| ------------ | ---------- |
| 1 回目失敗後 | 5 秒       |
| 2 回目失敗後 | 10 秒      |
| 3 回目失敗後 | スロー     |

最大 3 回試行（初回 + リトライ 2 回）。503 のような一時的な不調は数秒で回復するケースが多いため、5 秒・10 秒の固定インターバルで十分と判断する。

### Cloudflare Workers での `sleep` について

Workers では `setTimeout` ベースの Promise は動作する。

```ts
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
```

### 変更するコンポーネント

- **`src/fetcher.ts`** — `retryFetch` の再設計、`fetchFeed` の簡略化
- **`src/fetcher.test.ts`** — 待機処理のモック追加、新しい挙動のテスト追加

## 変更後のコード設計

```ts
const FEED_URL = "https://feeds.pinboard.in/json/popular/";
const RETRY_DELAYS_MS = [5_000, 10_000]; // 待機なし → 5秒 → 10秒

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchFeed(): Promise<Article[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
    try {
      const res = await fetch(FEED_URL);
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      const items: unknown = await res.json();
      if (!Array.isArray(items)) {
        throw new Error(`Unexpected response format: ${typeof items}`);
      }
      return (items as PinboardItem[]).map((item) => ({
        url: item.u,
        title: item.d,
        description: item.n,
        tags: item.t,
      }));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}
```

**変更のポイント：**

- `retryFetch` と `fetchFeed` を 1 つの関数に統合（`res.json()` を含めてリトライ対象に）
- リトライ前に `sleep` を挿入
- `Array.isArray` でレスポンス構造を検証

## テストの変更

- `vi.useFakeTimers()` で `sleep` をスキップし、テスト速度を維持する
- 以下のケースを追加：
  - 503 → 待機 → 成功（リトライが機能することを確認）
  - JSON パースエラー → 待機 → 成功
  - 非配列レスポンス → エラースロー

## 影響範囲

- `src/fetcher.ts` のみ変更
- 公開 API（`fetchFeed` の型シグネチャ）は変更なし
- `src/index.ts` への変更不要
