import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSettings() {
  const rows = await db.select().from(settings).where(eq(settings.id, 1));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  if (created) return created;
  const again = await db.select().from(settings).where(eq(settings.id, 1));
  return again[0];
}
