import { db } from "@/db";
import { learningProgress, operations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(learningProgress).orderBy(desc(learningProgress.updatedAt)).limit(100);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.topic !== "string" || !b.topic.trim()) return NextResponse.json({ error: "topic gerekli" }, { status: 400 });
  const topic = b.topic.trim().slice(0, 200);
  const existing = await db.select().from(learningProgress).where(eq(learningProgress.topic, topic)).limit(1);
  const values = {
    level: typeof b.level === "string" ? b.level.slice(0, 40) : "beginner",
    status: typeof b.status === "string" ? b.status.slice(0, 40) : "active",
    lastStep: typeof b.lastStep === "string" ? b.lastStep.slice(0, 500) : null,
    notes: typeof b.notes === "string" ? b.notes.slice(0, 2000) : null,
    completedSteps: Number.isFinite(b.completedSteps) ? Math.max(0, Math.trunc(b.completedSteps)) : 0,
    totalSteps: Number.isFinite(b.totalSteps) ? Math.max(0, Math.trunc(b.totalSteps)) : null,
    updatedAt: new Date(),
  };
  const [row] = existing[0]
    ? await db.update(learningProgress).set(values).where(eq(learningProgress.id, existing[0].id)).returning()
    : await db.insert(learningProgress).values({ topic, ...values }).returning();
  await db.insert(operations).values({
    action: "learning_update",
    summary: "Öğrenme ilerlemesi güncellendi: " + topic,
    status: "success",
    metadata: { learningId: row.id, status: row.status, completedSteps: row.completedSteps, totalSteps: row.totalSteps },
  });
  return NextResponse.json(row);
}