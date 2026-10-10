import { NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { contentItems, operations, tasks } from "@/db/schema";
import { generateWithFallback } from "@/lib/model-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const expected = process.env.MIRA_AUTOMATION_SECRET || process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const requestedId = Number(new URL(req.url).searchParams.get("contentId"));
  const hasId = Number.isInteger(requestedId) && requestedId > 0;
  const candidate = hasId
    ? await db.select().from(contentItems)
        .where(and(eq(contentItems.id, requestedId), eq(contentItems.status, "queued")))
        .limit(1)
    : await db.select().from(contentItems)
        .where(eq(contentItems.status, "queued"))
        .orderBy(contentItems.id)
        .limit(1);

  const item = candidate[0];
  if (!item) {
    return NextResponse.json({ ok: true, processed: false, message: "Kuyrukta içerik yok." });
  }

  // Claim atomically so two scheduled calls cannot process the same item.
  const [claimed] = await db.update(contentItems)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(contentItems.id, item.id), eq(contentItems.status, "queued")))
    .returning();

  if (!claimed) {
    return NextResponse.json({ ok: true, processed: false, message: "İçerik başka bir işlem tarafından alındı." });
  }

  try {
    const topic = claimed.topic?.trim() || claimed.title;
    const result = await generateWithFallback({
      system: [
        "Sen Mira'nın kısa video içerik üretim motorusun.",
        "Türkçe, özgün ve izleyiciyi ilk 2 saniyede yakalayan bir kısa video senaryosu üret.",
        "Çıktı yalnızca şu başlıklardan oluşsun: KANCA, SESLENDİRME, SAHNE ÖNERİLERİ, AÇIKLAMA, ETİKETLER.",
        "Süre 30-60 saniye olsun. Uydurma gerçekleri kesin bilgi gibi sunma.",
        "İçeriği yayınlama; yalnızca taslak hazırla.",
      ].join("\n"),
      history: [],
      message: `Platform: ${claimed.platform}\nKonu: ${topic}\nBaşlık: ${claimed.title}\nBir yayınlanmaya hazır kısa video taslağı üret.`,
    });

    const [savedOperation] = await db.insert(operations).values({
      action: "autonomous_content_draft",
      summary: `Mira otomatik içerik taslağı hazırladı: ${claimed.title}`,
      status: "success",
      platform: claimed.platform,
      metadata: {
        contentId: claimed.id,
        topic,
        title: claimed.title,
        provider: result.provider,
        model: result.model,
        script: result.content,
        requiresApprovalToPublish: true,
      },
    }).returning();

    const [updated] = await db.update(contentItems)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(contentItems.id, claimed.id))
      .returning();

    await db.update(tasks)
      .set({ status: "done", updatedAt: new Date() })
      .where(like(tasks.notes, `%"contentId":${claimed.id}%`));

    return NextResponse.json({
      ok: true,
      processed: true,
      content: updated,
      script: result.content,
      provider: result.provider,
      model: result.model,
      operationId: savedOperation.id,
      published: false,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db.update(contentItems)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(contentItems.id, claimed.id));
    await db.update(tasks)
      .set({ status: "failed", updatedAt: new Date() })
      .where(like(tasks.notes, `%"contentId":${claimed.id}%`));
    await db.insert(operations).values({
      action: "autonomous_content_draft",
      summary: `Mira otomatik içerik taslağı oluşturamadı: ${claimed.title}`,
      status: "failed",
      platform: claimed.platform,
      metadata: { contentId: claimed.id, error: reason.slice(0, 1500) },
    });
    return NextResponse.json({ ok: false, processed: true, error: reason.slice(0, 500) }, { status: 502 });
  }
}
