import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentItems, operations, tasks, trends } from "@/db/schema";
import { and, desc, eq, lte } from "drizzle-orm";
import { getDailyReport } from "@/lib/report";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const now = new Date();
  const [dueTasks, newTrends, draftContent, queuedContent, report] = await Promise.all([
    db.select().from(tasks)
      .where(and(eq(tasks.status, "pending"), lte(tasks.dueAt, now)))
      .orderBy(desc(tasks.id)).limit(50),
    db.select().from(trends)
      .where(eq(trends.status, "new"))
      .orderBy(desc(trends.foundAt)).limit(50),
    db.select().from(contentItems)
      .where(eq(contentItems.status, "draft"))
      .orderBy(desc(contentItems.updatedAt)).limit(50),
    db.select().from(contentItems)
      .where(eq(contentItems.status, "queued"))
      .orderBy(desc(contentItems.updatedAt)).limit(50),
    getDailyReport(),
  ]);

  const actions = [
    ...dueTasks.map((task) => ({ type: "task_due", id: task.id, title: task.title })),
    ...newTrends.map((trend) => ({ type: "trend_review", id: trend.id, topic: trend.topic, platform: trend.platform })),
    ...draftContent.map((content) => ({ type: "content_review", id: content.id, title: content.title, platform: content.platform })),
    ...queuedContent.map((content) => ({ type: "content_pipeline", id: content.id, title: content.title, platform: content.platform, topic: content.topic })),
  ];

  const [op] = await db.insert(operations).values({
    action: "automation_orchestrate",
    summary: `Otomasyon kuyruğu tarandı: ${actions.length} aksiyon`,
    status: "success",
    metadata: { dueTasks: dueTasks.length, newTrends: newTrends.length, draftContent: draftContent.length, queuedContent: queuedContent.length },
  }).returning();

  return NextResponse.json({
    ok: true,
    checkedAt: now.toISOString(),
    queues: { dueTasks, newTrends, draftContent, queuedContent },
    actions,
    report,
    operationId: op.id,
  });
}
