import { db } from "@/db";
import { learningProgress, operations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Geçersiz kayıt" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const patch: Partial<typeof learningProgress.$inferInsert> = { updatedAt: new Date() };
  for (const k of ["level","status","lastStep","notes"] as const) {
    if (typeof b[k] === "string") patch[k] = b[k].slice(0, k === "notes" ? 2000 : k === "lastStep" ? 500 : 40) as never;
  }
  if (Number.isFinite(b.completedSteps)) patch.completedSteps = Math.max(0, Math.trunc(b.completedSteps));
  if (Number.isFinite(b.totalSteps)) patch.totalSteps = Math.max(0, Math.trunc(b.totalSteps));
  const [row] = await db.update(learningProgress).set(patch).where(eq(learningProgress.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  await db.insert(operations).values({
    action: "learning_update",
    summary: "Öğrenme kaydı güncellendi: " + row.topic,
    status: "success",
    metadata: { learningId: row.id, status: row.status },
  });
  return NextResponse.json(row);
}