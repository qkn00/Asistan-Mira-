import { db } from "@/db";
import { memories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function listImportantMemories(limit = 20) {
  return db
    .select()
    .from(memories)
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(Math.min(100, Math.max(1, limit)));
}

export async function remember(key: string, value: string, category = "general", importance = 3) {
  const cleanKey = key.trim().slice(0, 200);
  const cleanValue = value.trim().slice(0, 4000);
  if (!cleanKey || !cleanValue) throw new Error("key ve value gerekli");
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
