import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentItems, operations } from "@/db/schema";
import { generateWithFallback } from "@/lib/model-manager";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const expected = process.env.MIRA_AUTOMATION_SECRET || process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

function metadataOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const drafts = await db.select().from(contentItems)
    .where(eq(contentItems.status, "draft"))
    .orderBy(desc(contentItems.updatedAt))
    .limit(50);

  if (drafts.length === 0) {
    return NextResponse.json({ ok: true, analyzed: false, count: 0, message: "Analiz edilecek taslak yok." });
  }

  const ids = drafts.map((draft) => draft.id);
  const [draftOps, analysisOps] = await Promise.all([
    db.select().from(operations)
      .where(and(eq(operations.action, "autonomous_content_draft"), inArray(operations.status, ["success", "failed"])))
      .orderBy(desc(operations.id))
      .limit(500),
    db.select().from(operations)
      .where(eq(operations.action, "content_draft_analysis"))
      .orderBy(desc(operations.id))
      .limit(200),
  ]);

  const latestScriptById = new Map<number, string>();
  for (const op of draftOps) {
    const meta = metadataOf(op.metadata);
    const id = Number(meta.contentId);
    if (ids.includes(id) && typeof meta.script === "string" && !latestScriptById.has(id)) {
      latestScriptById.set(id, meta.script);
    }
  }

  const alreadyAnalyzed = new Set<number>();
  for (const op of analysisOps) {
    const meta = metadataOf(op.metadata);
    if (Array.isArray(meta.analyzedContentIds)) {
      for (const id of meta.analyzedContentIds) {
        const parsedId = Number(id);
        if (Number.isInteger(parsedId) && parsedId > 0) alreadyAnalyzed.add(parsedId);
      }
    }
  }

  const pending = drafts
    .filter((draft) => !alreadyAnalyzed.has(draft.id) && latestScriptById.has(draft.id))
    .map((draft) => ({
      id: draft.id,
      title: draft.title,
      topic: draft.topic,
      createdAt: draft.createdAt,
      script: latestScriptById.get(draft.id),
    }));

  if (pending.length === 0) {
    return NextResponse.json({
      ok: true,
      analyzed: false,
      count: 0,
      draftsFound: drafts.length,
      message: "Yeni analiz bekleyen taslak yok veya taslakların metinleri bulunamadı.",
    });
  }

  const result = await generateWithFallback({
    system: [
      "Sen Mira'nın Bilgi Dozu YouTube Shorts editörü ve kalite analistisin.",
      "Verilen birikmiş taslakları birbiriyle karşılaştır. Her birine 100 üzerinden puan ver: ilk 2 saniye kancası (20), tek ve anlaşılır bilgi (20), kaynak/kanıt şeffaflığı (25), 20 saniyeye uygunluk (15), özgünlük ve tekrar etmeme (10), görsel anlatılabilirlik (10).",
      "Kaynak uydurma ve bir iddiayı dışarıdan doğrulamış gibi davranma. Metinde gerçek ve denetlenebilir kaynak yoksa bunu açıkça 'DOĞRULAMA GEREKLİ' olarak işaretle ve kaynak puanını düşür.",
      "40-48 kelimeyi aşan seslendirmeyi, çoklu konu/listeleri, belirsiz veya sansasyonel iddiaları, eksik zorunlu başlıkları ve ret/hata metinlerini işaretle.",
      "Her taslak için id, başlık, toplam puan, güçlü yan, sorunlar, düzeltilmesi gerekenler ve karar ver: 'ÖNE ÇIKAR', 'DÜZELT', 'ELE'. Ardından en iyi 1-3 taslağı sırala ve nedenlerini yaz.",
      "Yalnızca verilen taslaklara dayan. Taslak metinlerini değiştirme, veritabanındaki durumlarını değiştirme, yayınlama veya kullanıcı onayı varmış gibi davranma.",
      "Türkçe, kısa ve uygulanabilir bir analiz raporu üret. Raporu 'BİRİKEN TASLAKLAR ANALİZİ' başlığıyla başlat."
    ].join("\n"),
    history: [],
    message: JSON.stringify(pending),
  });

  const report = result.content.trim();
  if (!report || report.length < 80) {
    return NextResponse.json({ ok: false, error: "Model kullanılabilir bir analiz raporu üretmedi; sonuç kaydedilmedi." }, { status: 502 });
  }

  const [saved] = await db.insert(operations).values({
    action: "content_draft_analysis",
    summary: `Mira biriken ${pending.length} içerik taslağını analiz etti.`,
    status: "success",
    platform: "youtube",
    metadata: {
      analyzedContentIds: pending.map((draft) => draft.id),
      titles: pending.map((draft) => ({ id: draft.id, title: draft.title })),
      report,
      provider: result.provider,
      model: result.model,
      published: false,
      draftsChanged: false,
    },
  }).returning();

  return NextResponse.json({
    ok: true,
    analyzed: true,
    count: pending.length,
    contentIds: pending.map((draft) => draft.id),
    report,
    provider: result.provider,
    model: result.model,
    operationId: saved.id,
    published: false,
    draftsChanged: false,
  });
}
