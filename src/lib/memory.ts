import { db } from "@/db";
import { memories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|apikey|api_key)\s*[:=]\s*[^\s]+/i,
  /\b(?:bearer|access[_-]?token|refresh[_-]?token|oauth[_-]?token|id[_-]?token)\s*[:=]?\s*[^\s]{10,}/i,
  /\b(?:password|passwd|pwd)\s*[:=]\s*[^\s]+/i,
  /(?:-----\s?BEGIN|-----\s?END).{0,80}(?:RSA|OPENSSH|PRIVATE|PGP|DSA|EC).{0,80}KEY/i,
  /\b(?:postgres|mysql|mongodb|redis)(?:ql)?\s*:\/\/[^\s]*[:@]/i,
  /\b(?:github|gitlab|bitbucket)[_-]?(?:pat|token|secret)[_-]?[^\s]*\b/i,
  /\b(?:ghp_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{30,}/,
  /\b(?:AKIA|ASIA|aws_access_key_id|aws_secret_access_key)[^\s]*\b/i,
  /\b(?:aws_session_token|aws_secret_key)[^\s]*\b/i,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\b(?:azure[_-]?secret[_-]?key|azure[_-]?client[_-]?secret)[^\s]*\b/i,
  /\b(?:sk_live_|pk_live_|rk_live_)[A-Za-z0-9]{20,}/,
  /\bAC[a-z0-9]{32}\b/i,
];

function containsSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

export async function listImportantMemories(limit = 20) {
  return db
    .select()
    .from(memories)
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(Math.min(100, Math.max(1, limit)));
}

export function memoryWritePolicy(value: string) {
  return value.length <= 4000 && !containsSecret(value);
}

export async function remember(key: string, value: string, category = "general", importance = 3) {
  const cleanKey = key.trim().slice(0, 200);
  const cleanValue = value.trim().slice(0, 4000);
  if (!cleanKey || !cleanValue) throw new Error("key ve value gerekli");
  if (containsSecret(cleanValue)) throw new Error("Hassas kimlik bilgileri hafızaya kaydedilemez.");
  const safeImportance = Math.min(5, Math.max(1, Math.trunc(importance)));
  const existing = await db.select().from(memories).where(eq(memories.key, cleanKey)).limit(1);
  if (existing[0]) {
    const [row] = await db.update(memories).set({
      value: cleanValue,
      category: category.slice(0, 50),
      importance: safeImportance,
      updatedAt: new Date(),
    }).where(eq(memories.id, existing[0].id)).returning();
    return row;
  }
  const [row] = await db.insert(memories).values({
    key: cleanKey,
    value: cleanValue,
    category: category.slice(0, 50),
    importance: safeImportance,
  }).returning();
  return row;
}
