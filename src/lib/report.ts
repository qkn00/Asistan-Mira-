import { db } from "@/db";
import { contentItems, memories, operations, tasks, trends } from "@/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";

function dayBounds(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const start = new Date(`${y}-${m}-${d}T00:00:00+03:00`);
  const end = new Date(`${y}-${m}-${d}T23:59:59.999+03:00`);
  return { start, end };
}

export async function getDailyReport(date = new Date()) {
  const { start, end } = dayBounds(date);
  const [ops, doneTasks, touchedContent, todayPublished, todayTrends, activeTasks, memorySnapshot] = await Promise.all([
    db.select().from(operations)
      .where(and(gte(operations.createdAt, start), lte(operations.createdAt, end)))
      .orderBy(desc(operations.id)),
    db.select().from(tasks)
      .where(and(eq(tasks.status, "done"), gte(tasks.updatedAt, start), lte(tasks.updatedAt, end)))
      .orderBy(desc(tasks.id)),
    db.select().from(contentItems)
      .where(and(gte(contentItems.updatedAt, start), lte(contentItems.updatedAt, end)))
      .orderBy(desc(contentItems.id)),
    db.select().from(contentItems)
      .where(and(eq(contentItems.status, "published"), gte(contentItems.publishedAt, start), lte(contentItems.publishedAt, end)))
      .orderBy(desc(contentItems.publishedAt)),
    db.select().from(trends)
      .where(and(gte(trends.foundAt, start), lte(trends.foundAt, end)))
      .orderBy(desc(trends.id)),
    db.select().from(tasks)
      .where(eq(tasks.status, "pending"))
      .orderBy(desc(tasks.id)).limit(10),
    db.select({ key: memories.key, value: memories.value, category: memories.category, importance: memories.importance })
      .from(memories)
      .orderBy(desc(memories.importance), desc(memories.updatedAt)).limit(10),
  ]);

  const failedOps = ops.filter((x) => x.status === "failed");
  const successfulOps = ops.filter((x) => x.status === "success");
  const publishedViews = todayPublished.reduce((n, x) => n + x.views, 0);
  const publishedLikes = todayPublished.reduce((n, x) => n + x.likes, 0);
  const publishedComments = todayPublished.reduce((n, x) => n + x.comments, 0);

  return {
    date: start.toISOString().slice(0, 10),
    timezone: "Europe/Istanbul",
    operations: {
      total: ops.length,
      successful: successfulOps.length,
      failed: failedOps.length,
      items: ops.slice(0, 20),
      failures: failedOps.slice(0, 10),
    },
    tasks: {
      completedToday: doneTasks.length,
      pending: activeTasks.length,
      completed: doneTasks.slice(0, 20),
      next: activeTasks[0] ?? null,
    },
    content: {
      touchedToday: touchedContent.length,
      publishedToday: todayPublished.length,
      publishedViews,
      publishedLikes,
      publishedComments,
      published: todayPublished.slice(0, 20),
      touched: touchedContent.slice(0, 20),
    },
    trends: {
      foundToday: todayTrends.length,
      items: todayTrends.slice(0, 10),
    },
    memory: {
      important: memorySnapshot,
    },
  };
}

export function reportToSpeech(report: Awaited<ReturnType<typeof getDailyReport>>) {
  const parts: string[] = [];
  parts.push(`Bugün ${report.operations.successful} başarılı, ${report.operations.failed} başarısız işlem kaydım var`);
  parts.push(`${report.content.publishedToday} içerik yayın kaydı var`);
  if (report.content.publishedToday > 0) {
    parts.push(`${report.content.publishedViews.toLocaleString("tr-TR")} görüntülenme, ${report.content.publishedLikes.toLocaleString("tr-TR")} beğeni ve ${report.content.publishedComments.toLocaleString("tr-TR")} yorum kaydı var`);
  }
  parts.push(`${report.trends.foundToday} yeni trend kaydı bulundu`);
  parts.push(`${report.tasks.completedToday} görev tamamlandı`);
  if (report.tasks.pending > 0 && report.tasks.next) {
    parts.push(`bekleyen ${report.tasks.pending} görev var; sıradaki görev: ${report.tasks.next.title}`);
  }
  return parts.join("; ") + ".";
}
