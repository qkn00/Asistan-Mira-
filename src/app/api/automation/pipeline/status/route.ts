import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentItems, operations } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const contentId = Number(new URL(req.url).searchParams.get("contentId"));
  if (!Number.isInteger(contentId) || contentId <= 0) {
    return NextResponse.json({ error: "contentId gerekli" }, { status: 400 });
  }

  const [content] = await db.select().from(contentItems).where(eq(contentItems.id, contentId)).limit(1);
  if (!content) return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });

  const ops = await db.select().from(operations)
    .where(and(eq(operations.platform, content.platform)))
    .orderBy(desc(operations.id))
    .limit(100);

  const pipeline = ops
    .filter((op) => op.action.startsWith("content_pipeline_") && (op.metadata as { contentId?: number } | null)?.contentId === contentId)
    .map((op) => ({
      stage: op.action.replace("content_pipeline_", ""),
      status: op.status,
      summary: op.summary,
      createdAt: op.createdAt,
      metadata: op.metadata,
    }));

  const completed = new Set(pipeline.filter((x) => x.status === "success").map((x) => x.stage));
  const stages = ["research", "script", "voice", "video", "publish", "report"];
  const next = stages.find((stage) => !completed.has(stage)) ?? null;

  return NextResponse.json({
    ok: true,
    content,
    status: content.status,
    stages,
    completed,
    next,
    history: pipeline,
  });
}
