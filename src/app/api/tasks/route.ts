import { db } from "@/db";
import { operations, tasks } from "@/db/schema";
import { and, desc, eq, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const status = q.get("status");
  const dueBefore = q.get("dueBefore");
  const filters = [];
  if (status) filters.push(eq(tasks.status, status));
  if (dueBefore) {
    const d = new Date(dueBefore);
    if (!Number.isNaN(d.getTime())) filters.push(lte(tasks.dueAt, d));
  }
  const rows = await db.select().from(tasks).where(filters.length ? and(...filters) : undefined).orderBy(desc(tasks.id)).limit(100);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.title !== "string" || !b.title.trim()) return NextResponse.json({ error: "title gerekli" }, { status: 400 });
  const dueAt = b.dueAt ? new Date(b.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: "Geçersiz dueAt" }, { status: 400 });
  const [row] = await db.insert(tasks).values({
    title: b.title.trim().slice(0, 300),
    dueAt,
    recurrence: typeof b.recurrence === "string" ? b.recurrence.slice(0, 100) : null,
    notes: typeof b.notes === "string" ? b.notes.slice(0, 2000) : null,
    source: typeof b.source === "string" ? b.source.slice(0, 50) : "mira",
  }).returning();
  await db.insert(operations).values({ action: "task_create", summary: `Görev oluşturuldu: ${row.title}`, status: "success", metadata: { taskId: row.id, dueAt: row.dueAt } });
  return NextResponse.json(row, { status: 201 });
}
