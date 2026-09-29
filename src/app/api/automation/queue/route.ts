import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentItems, operations, tasks } from "@/db/schema";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const topic = typeof b.topic === "string" ? b.topic.trim().slice(0, 500) : "";
  const platform = typeof b.platform === "string" ? b.platform.trim().slice(0, 40) : "youtube";
  const title = typeof b.title === "string" && b.title.trim()
    ? b.title.trim().slice(0, 300)
    : topic.slice(0, 300) || "Yeni içerik";

  if (!topic) {
    return NextResponse.json({ error: "topic gerekli" }, { status: 400 });
  }

  const [content] = await db.insert(contentItems).values({
    title,
    platform,
    status: "queued",
    topic,
  }).returning();

  const [task] = await db.insert(tasks).values({
    title: `İçerik üretim hattını çalıştır: ${title}`,
    status: "pending",
    source: "mira",
    notes: JSON.stringify({
      type: "content_pipeline",
      contentId: content.id,
      platform,
      stages: ["research", "script", "voice", "video", "publish", "report"],
    }),
  }).returning();

  const [operation] = await db.insert(operations).values({
    action: "content_pipeline_queue",
    summary: `İçerik üretim hattına alındı: ${title}`,
    status: "queued",
    platform,
    metadata: {
      contentId: content.id,
      taskId: task.id,
      topic,
      stages: ["research", "script", "voice", "video", "publish", "report"],
    },
  }).returning();

  return NextResponse.json({
    ok: true,
    content,
    task,
    operation,
    pipeline: {
      status: "queued",
      stages: ["research", "script", "voice", "video", "publish", "report"],
      next: "research",
    },
  }, { status: 201 });
}
