import { db } from "@/db";
import { operations, trends } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Geçersiz trend" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const patch: Partial<typeof trends.$inferInsert> = {};
  if (typeof b.status === "string") patch.status = b.status.slice(0, 40);
  if (typeof b.notes === "string") patch.notes = b.notes.slice(0, 2000);
  if (Number.isFinite(b.score)) patch.score = Number(b.score);
  const [row] = await db.update(trends).set(patch).where(eq(trends.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Trend bulunamadı" }, { status: 404 });
  await db.insert(operations).values({
    action: "trend_update",
    summary: `Trend güncellendi: ${row.topic}`.slice(0, 1000),
    status: "success",
    platform: row.platform,
    metadata: { trendId: row.id, trendStatus: row.status, score: row.score },
  });
  return NextResponse.json(row);
}
