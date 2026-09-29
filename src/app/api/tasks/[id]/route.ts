import { db } from "@/db";
import { operations, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Geçersiz görev" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  if (typeof b.status === "string") patch.status = b.status.slice(0, 40);
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 300);
  if (b.dueAt !== undefined) patch.dueAt = b.dueAt ? new Date(b.dueAt) : null;
  if (typeof b.notes === "string") patch.notes = b.notes.slice(0, 2000);
  const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  await db.insert(operations).values({ action: "task_update", summary: `Görev güncellendi: ${row.title}`, status: "success", metadata: { taskId: row.id, taskStatus: row.status } });
  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Geçersiz görev" }, { status: 400 });
  const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  await db.insert(operations).values({ action: "task_delete", summary: `Görev silindi: ${row.title}`, status: "success", metadata: { taskId: row.id } });
  return NextResponse.json({ ok: true, id });
}
