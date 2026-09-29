import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentItems, operations, tasks } from "@/db/schema";
import { and, eq, like } from "drizzle-orm";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

const stages = ["research", "script", "voice", "video", "publish", "report"] as const;
type Stage = typeof stages[number];

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const contentId = Number(b.contentId);
  const stage = String(b.stage ?? "") as Stage;
  const status = b.status === "failed" ? "failed" : "success";

  if (!Number.isInteger(contentId) || contentId <= 0 || !stages.includes(stage)) {
    return NextResponse.json({ error: "contentId ve geçerli stage gerekli" }, { status: 400 });
  }

  const [content] = await db.select().from(contentItems).where(eq(contentItems.id, contentId)).limit(1);
  if (!content) return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });

  const output = b.output ?? null;
  const error = typeof b.error === "string" ? b.error.slice(0, 2000) : null;
  const nextIndex = stages.indexOf(stage) + 1;
  const next = status === "success" ? (stages[nextIndex] ?? "done") : "failed";

  const contentStatus =
    status === "failed" ? "failed" :
    stage === "publish" ? "published" :
    content.status === "queued" ? "processing" :
    content.status;

  const [updated] = await db.update(contentItems)
    .set({
      status: contentStatus,
      url: typeof b.url === "string" ? b.url.slice(0, 2000) : content.url,
      externalId: typeof b.externalId === "string" ? b.externalId.slice(0, 500) : content.externalId,
      publishedAt: stage === "publish" && status === "success" ? (b.publishedAt ? new Date(b.publishedAt) : new Date()) : content.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(contentItems.id, contentId))
    .returning();

  await db.insert(operations).values({
    action: `content_pipeline_${stage}`,
    summary: status === "success"
      ? `İçerik hattı ${stage} aşamasını tamamladı: ${updated.title}`
      : `İçerik hattı ${stage} aşamasında başarısız oldu: ${updated.title}`,
    status,
    platform: updated.platform,
    externalId: updated.externalId,
    metadata: { contentId, stage, next, output, error, url: updated.url },
  });

  if (status === "failed" || stage === "publish") {
    await db.update(tasks)
      .set({ status: status === "failed" ? "failed" : "done", updatedAt: new Date() })
      .where(like(tasks.notes, `%"contentId":${contentId}%`));
  }

  return NextResponse.json({
    ok: true,
    content: updated,
    stage,
    status,
    next,
    output,
    error,
  });
}
