import { db } from "@/db";
import { operations, trends } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { const status = new URL(req.url).searchParams.get("status"); const rows = await db.select().from(trends).where(status ? eq(trends.status, status) : undefined).orderBy(desc(trends.foundAt)).limit(100); return NextResponse.json(rows); }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.topic !== "string" || !b.topic.trim()) return NextResponse.json({ error: "topic gerekli" }, { status: 400 });
  const [row] = await db.insert(trends).values({ topic: b.topic.trim().slice(0,300), platform: typeof b.platform === "string" ? b.platform.slice(0,40) : null, sourceUrl: typeof b.sourceUrl === "string" ? b.sourceUrl.slice(0,1000) : null, score: Number.isFinite(b.score) ? Number(b.score) : null, status: typeof b.status === "string" ? b.status.slice(0,40) : "new", notes: typeof b.notes === "string" ? b.notes.slice(0,2000) : null }).returning();
  await db.insert(operations).values({ action: "trend_create", summary: `Trend kaydı oluşturuldu: ${row.topic}`, status: "success", platform: row.platform, metadata: { trendId: row.id, score: row.score } });
  return NextResponse.json(row, { status: 201 });
}
