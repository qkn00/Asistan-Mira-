import { db } from "@/db";
import { memories, operations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { remember } from "@/lib/memory";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    await db.select().from(memories).orderBy(desc(memories.importance), desc(memories.updatedAt)).limit(200),
  );
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.key !== "string" || typeof b.value !== "string") {
    return NextResponse.json({ error: "key ve value gerekli" }, { status: 400 });
  }
  const row = await remember(
    b.key,
    b.value,
    typeof b.category === "string" ? b.category : "general",
    Number.isFinite(b.importance) ? b.importance : 3,
  );
  await db.insert(operations).values({
    action: "memory_save",
    summary: `Hafıza kaydedildi: ${row.key}`,
    status: "success",
    metadata: { memoryId: row.id, category: row.category },
  });
  return NextResponse.json(row, { status: 200 });
}

export async function DELETE(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key gerekli" }, { status: 400 });
  const [row] = await db.delete(memories).where(eq(memories.key, key)).returning();
  if (!row) return NextResponse.json({ error: "Hafıza bulunamadı" }, { status: 404 });
  await db.insert(operations).values({
    action: "memory_delete",
    summary: `Hafıza silindi: ${row.key}`,
    status: "success",
    metadata: { memoryId: row.id },
  });
  return NextResponse.json({ ok: true, key: row.key });
}
