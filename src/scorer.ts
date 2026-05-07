import type { Article, FetchedArticle, ScoredArticle } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const STAGE1_MAX_RESULTS = 30;

interface ScoreEntry {
  url: string;
  score: number;
}

interface OpenAIScoreResponse {
  articles: ScoreEntry[];
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a frontend engineer curator. Score each article from 0 to 10 based on relevance to frontend development (React, TypeScript, CSS, web performance, browser APIs, etc.). Return JSON: {"articles": [{"url": "...", "score": N}, ...]}',
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

export async function scoreStage1(articles: Article[], apiKey: string): Promise<ScoredArticle[]> {
  const prompt = articles
    .map((a) => `URL: ${a.url}\nTitle: ${a.title}\nDescription: ${a.description}`)
    .join("\n\n");

  const content = await callOpenAI(prompt, apiKey);

  let parsed: OpenAIScoreResponse;
  try {
    parsed = JSON.parse(content) as OpenAIScoreResponse;
  } catch {
    throw new Error(`Failed to parse OpenAI response: ${content}`);
  }

  const scoreMap = new Map(parsed.articles.map((e) => [e.url, e.score]));

  const scored: ScoredArticle[] = articles
    .filter((a) => scoreMap.has(a.url))
    .map((a) => ({ ...a, score: scoreMap.get(a.url) as number }));

  return scored.sort((a, b) => b.score - a.score).slice(0, STAGE1_MAX_RESULTS);
}

export async function scoreStage2(
  articles: FetchedArticle[],
  apiKey: string,
): Promise<FetchedArticle[]> {
  const prompt = articles
    .map(
      (a) =>
        `URL: ${a.url}\nTitle: ${a.fetchedTitle || a.title}\nDescription: ${a.fetchedDescription || a.description}`,
    )
    .join("\n\n");

  const content = await callOpenAI(prompt, apiKey);

  let parsed: OpenAIScoreResponse;
  try {
    parsed = JSON.parse(content) as OpenAIScoreResponse;
  } catch {
    throw new Error(`Failed to parse OpenAI response: ${content}`);
  }

  const scoreMap = new Map(parsed.articles.map((e) => [e.url, e.score]));

  return articles
    .filter((a) => scoreMap.has(a.url))
    .map((a) => ({ ...a, score: scoreMap.get(a.url) as number }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
