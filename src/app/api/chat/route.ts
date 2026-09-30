import { NextResponse } from "next/server";
import { getN8nStatus } from "@/lib/n8n-status";
import { db } from "@/db";
import { contentItems, learningProgress, messages, operations, tasks, trends } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { think, detectEmotion } from "@/lib/brain";
import { getSettings } from "@/lib/settings";
import { getDailyReport, reportToSpeech } from "@/lib/report";
import { listImportantMemories, remember } from "@/lib/memory";
import { researchShortVideos } from "@/lib/video-research";

export const dynamic = "force-dynamic";

const fallbackSettings = {
  userName: "patron",
  outfit: "sweater",
  voiceRate: 1,
  voicePitch: 1.15,
  persona: "flirty" as const,
  glamour: true,
};

async function safeSettings() {
  try {
    return (await getSettings()) ?? fallbackSettings;
  } catch (error) {
    console.error("Mira settings unavailable; using fallback:", error);
    return fallbackSettings;
  }
}

export async function GET() {
  try {
    const rows = await db.select().from(messages).orderBy(desc(messages.id)).limit(50);
    return NextResponse.json(rows.reverse());
  } catch (error) {
    console.error("Mira chat history unavailable:", error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!text) return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });

  const rawSettings = await safeSettings();
  const s = rawSettings.userName === "Gökhan" ? { ...rawSettings, userName: "patron" } : rawSettings;
  const lower = text.toLocaleLowerCase("tr-TR");

  // Live video research: only answer current Shorts/trend questions from
  // freshly fetched YouTube Data API results. Never let the language model
  // invent current view counts, titles or rankings.
  const asksLiveVideoResearch =
    /(anlık|şu an|şuan|güncel|bugün|son 24 saat|son 24 saatte|çok izlenen|cok izlenen|en çok izlenen|en cok izlenen|en fazla izlenen|en fazla izlen|izlenme|trend|viral|popüler|popular)/i.test(lower) &&
    /(video|short|shorts|tiktok|reels|izlen|trend|viral|popüler|popular)/i.test(lower);

  if (asksLiveVideoResearch) {
    try {
      const queryMatch = text.match(/(?:konu|konusunda|hakkında|hakkinda)\s+(.+)$/i);
      const query = queryMatch?.[1]?.trim() ?? "";
      const research = await researchShortVideos(query, 24, "TR", 10);

      const reply = research.items.length
        ? [
            "Son 24 saatte Türkiye bölgesinde yayınlanan Shorts sonuçları:",
            "",
            ...research.items.map((item) =>
              `#${item.rank} — ${item.title} — ${item.channel} — ${item.views.toLocaleString("tr-TR")} izlenme`
            ),
            "",
            `Araştırma zamanı: ${research.searchedAt}`,
            "Kaynak: YouTube Data API.",
          ].join("\n")
        : `Son 24 saatte Türkiye bölgesinde eşleşen Shorts bulunamadı. Araştırma zamanı: ${research.searchedAt}. Kaynak: YouTube Data API.`;

      try {
        await db.execute(sql\`select 1\`);
        const [userMsg] = await db.insert(messages).values({
          role: "user",
          content: text,
          emotion: detectEmotion(text),
        }).returning();
        const [assistantMsg] = await db.insert(messages).values({
          role: "assistant",
          content: reply,
          emotion: "focused",
        }).returning();
        await db.insert(operations).values({
          action: "live_video_research",
          summary: "YouTube Data API ile canlı Shorts araştırması yapıldı",
          status: "success",
          metadata: research,
        });
        return NextResponse.json({ user: userMsg, assistant: assistantMsg, persisted: true, research });
      } catch (error) {
        console.error("Live video research persistence failed:", error);
      }

      const now = new Date().toISOString();
      return NextResponse.json({
        user: { id: -Date.now(), role: "user", content: text, emotion: detectEmotion(text), createdAt: now },
        assistant: { id: -Date.now() - 1, role: "assistant", content: reply, emotion: "focused", createdAt: now },
        persisted: false,
        research,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error("Mira live video research failed:", reason);
      const reply = /YOUTUBE_API_KEY missing/.test(reason)
        ? "Anlık video araştırması için YOUTUBE_API_KEY eksik. Railway Variables içinde anahtarın bulunduğunu doğrula; anahtar olmadan sayı veya sıralama uydurmayacağım."
        : `Anlık video araştırması başarısız oldu: ${reason.slice(0, 300)}`;
      return NextResponse.json({ error: reply }, { status: 503 });
    }
  }

  // The chat must remain usable even before Railway PostgreSQL is connected.
  // Persistence is attempted first; if it is unavailable, Mira answers
  // normally and the UI receives transient message objects instead of a
  // generic "connection problem" response.
  let databaseAvailable = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    databaseAvailable = false;
  }

  const rememberMatch = text.match(/^\s*(?:bunu )?hatırla\s*[:：-]\s*(.+)$/i);
  if (rememberMatch && databaseAvailable) {
    const value = rememberMatch[1].trim();
    const key = `user_note_${Date.now()}`;
    try {
      const row = await remember(key, value, "user_note", 4);
      const reply = `Tamam ${s.userName}, bunu hafızama kaydettim.`;
      const [userMsg] = await db.insert(messages).values({ role: "user", content: text, emotion: "focused" }).returning();
      const [assistantMsg] = await db.insert(messages).values({ role: "assistant", content: reply, emotion: "happy" }).returning();
      await db.insert(operations).values({ action: "memory_save", summary: `Kalıcı hafızaya kayıt: ${value.slice(0, 180)}`, status: "success", metadata: { memoryId: row.id } });
      return NextResponse.json({ user: userMsg, assistant: assistantMsg, memory: row });
    } catch (error) {
      console.error("Mira memory save failed:", error);
      databaseAvailable = false;
    }
  }

  if (/(bugün neler yaptık|bugün ne yaptık|günlük rapor|bugünkü rapor)/.test(lower) && databaseAvailable) {
    try {
      const report = await getDailyReport();
      const reply = reportToSpeech(report);
      const [userMsg] = await db.insert(messages).values({ role: "user", content: text, emotion: "focused" }).returning();
      const [assistantMsg] = await db.insert(messages).values({ role: "assistant", content: reply, emotion: "focused" }).returning();
      await db.insert(operations).values({ action: "daily_report", summary: "Günlük rapor Mira tarafından oluşturuldu", status: "success", metadata: report });
      return NextResponse.json({ user: userMsg, assistant: assistantMsg, report });
    } catch (error) {
      console.error("Mira daily report unavailable:", error);
    }
  }

  let recent: { role: "user" | "assistant"; content: string }[] = [];
  let memories: Awaited<ReturnType<typeof listImportantMemories>> = [];
  let operationalContext = "";

  if (databaseAvailable) {
    try {
      recent = (await db.select().from(messages).orderBy(desc(messages.id)).limit(10))
        .reverse()
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      memories = await listImportantMemories(20);
      const [pendingTasks, recentContent, activeLearning, recentTrends] = await Promise.all([
        db.select().from(tasks).where(eq(tasks.status, "pending")).orderBy(desc(tasks.id)).limit(8),
        db.select().from(contentItems).orderBy(desc(contentItems.updatedAt)).limit(8),
        db.select().from(learningProgress).where(eq(learningProgress.status, "active")).orderBy(desc(learningProgress.updatedAt)).limit(8),
        db.select().from(trends).orderBy(desc(trends.foundAt)).limit(8),
      ]);
      operationalContext = [
        "GÖREVLER: " + (pendingTasks.length ? pendingTasks.map(x => x.title + (x.dueAt ? " (son tarih " + x.dueAt.toISOString() + ")" : "")).join(" | ") : "Bekleyen görev yok."),
        "İÇERİK: " + (recentContent.length ? recentContent.map(x => x.title + " [" + x.platform + "/" + x.status + "]" + (x.url ? " " + x.url : "")).join(" | ") : "İçerik kaydı yok."),
        "ÖĞRENME: " + (activeLearning.length ? activeLearning.map(x => x.topic + " (" + x.level + ", " + x.completedSteps + "/" + (x.totalSteps ?? "?") + ", son adım: " + (x.lastStep ?? "-") + ")").join(" | ") : "Aktif öğrenme kaydı yok."),
        "TRENDLER: " + (recentTrends.length ? recentTrends.map(x => x.topic + (x.platform ? " [" + x.platform + "]" : "")).join(" | ") : "Trend kaydı yok."),
      ].join("\n");
    } catch (error) {
      console.error("Mira context unavailable:", error);
      databaseAvailable = false;
    }
  }

  const memoryContext = [
    memories.length ? memories.map((m) => "- " + m.key + ": " + m.value).join("\n") : "(Henüz kayıtlı önemli hafıza yok.)",
    operationalContext ? "\nAKTİF İŞ DURUMU:\n" + operationalContext : "",
  ].join("\n");

  const n8nStatus = await getN8nStatus();

  const statusContext = [
    "Veritabanı: " + (databaseAvailable ? "bağlı ve okunabiliyor." : "bağlı değil; bu istek geçici verilerle yanıtlanıyor."),
    "Kalıcı hafıza: " + (databaseAvailable ? (memories.length ? "okunabiliyor; son önemli kayıtlar yüklendi." : "çalışıyor fakat şu an önemli kayıt bulunamadı.") : "bu istekte doğrulanamadı."),
    "Görev/iş takibi: " + (databaseAvailable ? "okunabiliyor." : "doğrulanamadı."),
    "Aktif öğrenme: " + (databaseAvailable ? (operationalContext.includes("ÖĞRENME:") ? "durumu okunabiliyor." : "durumu okunamadı.") : "doğrulanamadı."),
    "İçerik ve operasyon kayıtları: " + (databaseAvailable ? "okunabiliyor." : "doğrulanamadı."),
    "Model sağlayıcıları: " + [process.env.OPENAI_API_KEY ? "OpenAI" : "", process.env.GEMINI_API_KEY ? "Gemini" : "", process.env.ANTHROPIC_API_KEY ? "Claude" : ""].filter(Boolean).join(", ") + (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY ? " yapılandırılmış." : " yapılandırılmamış; yerel cevap motoru kullanılabilir."),
    "ElevenLabs TTS: " + (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID ? "yapılandırılmış." : "tam yapılandırılmamış; tarayıcı sesi fallback olabilir."),
    "n8n otomasyon altyapısı: " + (process.env.MIRA_N8N_SECRET ? "güvenli bağlantı anahtarı yapılandırılmış." : "MIRA_N8N_SECRET yapılandırılmamış."),
    "n8n canlı sunucu erişimi: " + (n8nStatus.reachable ? "doğrulandı." : "doğrulanamadı.") + " " + n8nStatus.message,
    "n8n workflow doğrulaması: " + (n8nStatus.workflowVerified ? (n8nStatus.workflowActive ? "seçilen workflow aktif." : "seçilen workflow aktif değil.") : "doğrulanmadı."),
    "n8n canlı workflow aktivasyonu: artık yalnızca canlı n8n kontrolü doğrularsa aktif kabul edilir.",
    "Yetki sistemi (beyaz/sarı/kırmızı): henüz tamamlanmış olarak işaretlenmemeli.",
    "Proaktif sabah raporu: altyapısı var; nihai otomatik davranış ayrıca tamamlanmalı.",
  ].join("\n");

  const { reply, emotion } = await think(
    text,
    recent,
    s.userName,
    s.persona === "sweet" ? "sweet" : "flirty",
    memoryContext,
    statusContext,
  );

  if (!databaseAvailable) {
    const now = new Date().toISOString();
    return NextResponse.json({
      user: { id: -Date.now(), role: "user", content: text, emotion: detectEmotion(text), createdAt: now },
      assistant: { id: -Date.now() - 1, role: "assistant", content: reply, emotion, createdAt: now },
      persisted: false,
      warning: "Mira PostgreSQL'e henüz bağlanmadı; bu konuşma geçici.",
    });
  }

  try {
    const [userMsg] = await db
      .insert(messages)
      .values({ role: "user", content: text, emotion: detectEmotion(text) })
      .returning();

    const [assistantMsg] = await db
      .insert(messages)
      .values({ role: "assistant", content: reply, emotion })
      .returning();

    await db.insert(operations).values({
      action: "chat",
      summary: `Mira sohbet yanıtı verdi: ${text.slice(0, 180)}`,
      status: "success",
    });

    return NextResponse.json({ user: userMsg, assistant: assistantMsg, persisted: true });
  } catch (error) {
    console.error("Mira chat persistence failed:", error);
    const now = new Date().toISOString();
    return NextResponse.json({
      user: { id: -Date.now(), role: "user", content: text, emotion: detectEmotion(text), createdAt: now },
      assistant: { id: -Date.now() - 1, role: "assistant", content: reply, emotion, createdAt: now },
      persisted: false,
      warning: "Yanıt verildi ancak veritabanına kaydedilemedi.",
    });
  }
}

export async function DELETE() {
  try {
    await db.delete(messages);
  } catch (error) {
    console.error("Mira chat history delete failed:", error);
  }
  return NextResponse.json({ ok: true });
}
