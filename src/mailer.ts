import type { Env, SummarizedArticle } from "./types";

const RESEND_API_URL = "https://api.resend.com/emails";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildMailBody(articles: SummarizedArticle[]): string {
  const lines: string[] = [];

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const title = a.fetchedTitle || a.title;

    lines.push(`${i + 1}. ${title}`);
    lines.push(a.url);
    lines.push(a.summary);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export async function sendMail(articles: SummarizedArticle[], env: Env): Promise<void> {
  const subject = `[Daily Pinboard] ${formatDate(new Date())} のフロントエンド記事`;
  const text = buildMailBody(articles);

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Daily Pinboard <onboarding@resend.dev>",
      to: [env.TO_EMAIL],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend API error: ${res.status}`);
  }
}
