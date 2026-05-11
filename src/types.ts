export type FeedSource = "pinboard" | "devto";

export interface PinboardItem {
  u: string;
  d: string;
  n: string;
  t: string[];
}

export interface DevToArticle {
  url: string;
  title: string;
  description: string | null;
  tag_list: string[];
}

export interface Article {
  url: string;
  title: string;
  description: string;
  tags: string[];
}

export interface ScoredArticle extends Article {
  score: number;
}

export interface FetchedArticle extends ScoredArticle {
  fetchedTitle: string;
  fetchedDescription: string;
  bodyText: string;
}

export interface SummarizedArticle extends FetchedArticle {
  summary: string;
}

export interface Env {
  DB: D1Database;
  OPENAI_API_KEY: string;
  RESEND_API_KEY: string;
  TO_EMAIL: string;
}
