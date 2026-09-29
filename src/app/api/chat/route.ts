import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, operations } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { think, detectEmotion } from "@/lib/brain";
import { getSettings } from "@/lib/settings";
import { getDailyReport, reportToSpeech } from "@/lib/report";
import { listImportantMemories, remember } from "@/lib/memory";

export const dynamic = "force-dynamic";

const fallbackSettings = {
  userName: "Gökhan",
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

  const s = await safeSettings();
  const lower = text.toLocaleLowerCase("tr-TR");

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

  if (databaseAvailable) {
    try {
      recent = (await db.select().from(messages).orderBy(desc(messages.id)).limit(10))
        .reverse()
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      memories = await listImportantMemories(20);
    } catch (error) {
      console.error("Mira context unavailable:", error);
      databaseAvailable = false;
    }
  }

  const memoryContext = memories.length
    ? memories.map((m) => `- ${m.key}: ${m.value}`).join("\n")
    : "(Henüz kayıtlı önemli hafıza yok.)";

  const { reply, emotion } = await think(
    text,
    recent,
    s.userName,
    s.persona === "sweet" ? "sweet" : "flirty",
    memoryContext,
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
