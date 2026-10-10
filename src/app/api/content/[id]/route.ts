import { db } from "@/db";
import { contentItems, operations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Geçersiz içerik" }, { status: 400 });
  }

  const [content] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!content) return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });

  const draftOperations = await db.select().from(operations)
    .where(eq(operations.action, "autonomous_content_draft"))
    .orderBy(desc(operations.id))
    .limit(50);
  const draft = draftOperations.find((operation) => {
    const metadata = operation.metadata && typeof operation.metadata === "object"
      ? operation.metadata as Record<string, unknown>
      : {};
    return metadata.contentId === id && typeof metadata.script === "string";
  });
  const metadata = draft?.metadata && typeof draft.metadata === "object"
    ? draft.metadata as Record<string, unknown>
    : {};

  return NextResponse.json({
    ...content,
    generatedScript: typeof metadata.script === "string" ? metadata.script : null,
    generation: draft ? { provider: metadata.provider ?? null, model: metadata.model ?? null, status: draft.status } : null,
  });
}

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
