import type { FetchedArticle, SummarizedArticle } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function summarizeArticle(article: FetchedArticle, apiKey: string): Promise<string> {
  const title = article.fetchedTitle || article.title;
  const description = article.fetchedDescription || article.description;

  const prompt = `Title: ${title}\nDescription: ${description}\nBody: ${article.bodyText}`;

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたはフロントエンドエンジニア向けのキュレーターです。与えられた記事の内容を2〜3文の日本語で要約してください。技術的なポイントを簡潔にまとめてください。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json<{ choices: { message: { content: string } }[] }>();
  return data.choices[0].message.content;
}

export async function summarizeArticles(
  articles: FetchedArticle[],
  apiKey: string,
): Promise<SummarizedArticle[]> {
  const results: SummarizedArticle[] = [];

  for (const article of articles) {
    const summary = await summarizeArticle(article, apiKey);
    results.push({ ...article, summary });
  }

  return results;
}
