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

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const requestedId = Number(b.contentId);
  const hasId = Number.isInteger(requestedId) && requestedId > 0;

  const candidate = hasId
    ? await db.select().from(contentItems).where(and(eq(contentItems.id, requestedId), eq(contentItems.status, "queued"))).limit(1)
    : await db.select().from(contentItems).where(eq(contentItems.status, "queued")).orderBy(contentItems.id).limit(1);

  const content = candidate[0];
  if (!content) {
    return NextResponse.json({ ok: true, claimed: false, message: "Kuyrukta içerik yok" });
  }

  const [claimed] = await db.update(contentItems)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(contentItems.id, content.id), eq(contentItems.status, "queued")))
    .returning();

  if (!claimed) {
    return NextResponse.json({ ok: true, claimed: false, message: "İçerik başka bir işlem tarafından alındı" });
  }

  await db.update(tasks)
    .set({ status: "processing", updatedAt: new Date() })
    .where(like(tasks.notes, `%"contentId":${content.id}%`));

  const [operation] = await db.insert(operations).values({
    action: "content_pipeline_claim",
    summary: `İçerik üretim hattı başlatıldı: ${claimed.title}`,
    status: "processing",
    platform: claimed.platform,
    metadata: { contentId: claimed.id, topic: claimed.topic, next: "research" },
  }).returning();

  return NextResponse.json({
    ok: true,
    claimed: true,
    content: claimed,
    operationId: operation.id,
    next: "research",
  });
}
