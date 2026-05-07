import { fetchArticles } from "./articleFetcher";
import { cleanupExpiredRecords, deduplicateArticles, recordSentArticles } from "./deduplicator";
import { fetchFeed } from "./fetcher";
import { sendMail } from "./mailer";
import { scoreStage1, scoreStage2 } from "./scorer";
import { summarizeArticles } from "./summarizer";
import type { Env } from "./types";

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log("Daily Pinboard: start");

    const raw = await fetchFeed();
    console.log(`Fetched ${raw.length} articles from feed`);

    const stage1 = await scoreStage1(raw, env.OPENAI_API_KEY);
    console.log(`Stage1 scored: ${stage1.length} articles`);

    const deduplicated = await deduplicateArticles(stage1, env.DB);
    console.log(`After deduplication: ${deduplicated.length} articles`);

    await cleanupExpiredRecords(env.DB);

    const fetched = await fetchArticles(deduplicated);
    console.log(`Fetched article bodies: ${fetched.length} articles`);

    const stage2 = await scoreStage2(fetched, env.OPENAI_API_KEY);
    console.log(`Stage2 scored: ${stage2.length} articles selected`);

    const summarized = await summarizeArticles(stage2, env.OPENAI_API_KEY);
    console.log(`Summarized: ${summarized.length} articles`);

    await sendMail(summarized, env);
    console.log("Mail sent");

    await recordSentArticles(
      summarized.map((a) => a.url),
      env.DB,
    );
    console.log("Recorded sent articles");

    console.log("Daily Pinboard: done");
  },
};
