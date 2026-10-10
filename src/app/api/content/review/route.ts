import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentItems, operations } from "@/db/schema";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  return req.headers.get("cookie")?.split(";").some((part) => part.trim() === "mira_entry=1") ?? false;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status");
  const allowedStatus = status === "approved" || status === "rejected" ? status : "draft";
  const rows = await db.select().from(contentItems)
    .where(eq(contentItems.status, allowedStatus))
    .orderBy(desc(contentItems.updatedAt))
    .limit(50);

  if (!rows.length) return NextResponse.json([]);
  const ids = rows.map((row) => row.id);
  const draftOps = await db.select().from(operations)
    .where(and(eq(operations.action, "autonomous_content_draft"), inArray(operations.status, ["success", "failed"])))
    .orderBy(desc(operations.id))
    .limit(500);

  const latestById = new Map<number, (typeof draftOps)[number]>();
  for (const op of draftOps) {
    const metadata = op.metadata && typeof op.metadata === "object" ? op.metadata as Record<string, unknown> : {};
    const id = Number(metadata.contentId);
    if (ids.includes(id) && !latestById.has(id) && typeof metadata.script === "string") latestById.set(id, op);
  }

  return NextResponse.json(rows.map((row) => {
    const op = latestById.get(row.id);
    const metadata = op?.metadata && typeof op.metadata === "object" ? op.metadata as Record<string, unknown> : {};
    return {
      ...row,
      generatedScript: typeof metadata.script === "string" ? metadata.script : null,
      generation: op ? { provider: metadata.provider ?? null, model: metadata.model ?? null } : null,
    };
  }));
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const action = body.action;
  if (!Number.isInteger(id) || id <= 0 || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const nextStatus = action === "approve" ? "approved" : "rejected";
  const [row] = await db.update(contentItems)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(contentItems.id, id), eq(contentItems.status, "draft")))
    .returning();

  if (!row) return NextResponse.json({ error: "Taslak bulunamadı veya daha önce değerlendirilmiş." }, { status: 409 });

  await db.insert(operations).values({
    action: action === "approve" ? "content_approved" : "content_rejected",
    summary: `İçerik taslağı ${action === "approve" ? "onaylandı" : "reddedildi"}: ${row.title}`,
    status: "success",
    platform: row.platform,
    externalId: row.externalId,
    metadata: { contentId: row.id, contentStatus: nextStatus, approvedByUser: true, published: false },
  });

  return NextResponse.json({ ok: true, status: nextStatus, published: false, content: row });
}
