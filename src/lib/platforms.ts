export type ContentPlatform = "youtube" | "tiktok";

export function normalizePlatform(value: unknown): ContentPlatform | null {
  const p = String(value ?? "").toLocaleLowerCase("tr-TR");
  if (p === "youtube" || p === "youtube shorts" || p === "yt") return "youtube";
  if (p === "tiktok" || p === "tik tok") return "tiktok";
  return null;
}

export type PublishResult = {
  platform: ContentPlatform;
  title: string;
  status: "published" | "failed" | "draft";
  externalId?: string | null;
  url?: string | null;
  views?: number;
  likes?: number;
  comments?: number;
  publishedAt?: string | null;
  error?: string | null;
};
