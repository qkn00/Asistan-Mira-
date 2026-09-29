import { db } from "@/db";
import { contentItems, operations, tasks } from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const now = new Date();
  const staleSince = new Date(now.getTime() - 30 * 60 * 1000);
  const [overdue, failed, processing] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.status, "pending"), lt(tasks.dueAt, now))).orderBy(desc(tasks.id)).limit(20),
    db.select().from(operations).where(eq(operations.status, "failed")).orderBy(desc(operations.id)).limit(20),
    db.select().from(contentItems).where(eq(contentItems.status, "processing")).orderBy(desc(contentItems.updatedAt)).limit(20),
  ]);
  const stale = processing.filter((x) => x.updatedAt < staleSince);
  const alerts = [
    ...overdue.map((x) => ({ type: "overdue_task", severity: "warning", title: "Geciken görev", message: x.title, taskId: x.id })),
    ...failed.map((x) => ({ type: "failed_operation", severity: "error", title: "Başarısız işlem", message: x.summary, operationId: x.id })),
    ...stale.map((x) => ({ type: "stale_content", severity: "warning", title: "Takılmış içerik", message: x.title, contentId: x.id })),
  ];
  return NextResponse.json({ checkedAt: now.toISOString(), count: alerts.length, alerts });
}