import { db } from "@/db";
import { contentItems, operations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Geçersiz içerik" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const patch: Partial<typeof contentItems.$inferInsert> = { updatedAt: new Date() };
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 300);
  if (typeof b.platform === "string" && b.platform.trim()) patch.platform = b.platform.trim().slice(0, 40);
  if (typeof b.status === "string") patch.status = b.status.slice(0, 40);
  if (typeof b.topic === "string") patch.topic = b.topic.slice(0, 300);
  if (typeof b.externalId === "string") patch.externalId = b.externalId.slice(0, 500);
  if (typeof b.url === "string") patch.url = b.url.slice(0, 2000);
  for (const key of ["views", "likes", "comments"] as const) {
    if (Number.isFinite(b[key])) patch[key] = Math.max(0, Math.trunc(Number(b[key])));
  }
  if (b.publishedAt !== undefined) patch.publishedAt = b.publishedAt ? new Date(b.publishedAt) : null;

  const [row] = await db.update(contentItems).set(patch).where(eq(contentItems.id, id)).returning();
  if (!row) return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });

  await db.insert(operations).values({
    action: "content_update",
    summary: `${row.platform} içeriği güncellendi: ${row.title}`.slice(0, 1000),
    status: "success",
    platform: row.platform,
    externalId: row.externalId,
    metadata: { contentId: row.id, status: row.status, views: row.views, likes: row.likes, comments: row.comments },
  });
  return NextResponse.json(row);
}
