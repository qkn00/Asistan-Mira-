import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, operations } from "@/db/schema";
import { desc } from "drizzle-orm";
import { think, detectEmotion } from "@/lib/brain";
import { getSettings } from "@/lib/settings";
import { getDailyReport, reportToSpeech } from "@/lib/report";
import { listImportantMemories, remember } from "@/lib/memory";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(messages).orderBy(desc(messages.id)).limit(50);
  return NextResponse.json(rows.reverse());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!text) return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });

  const s = await getSettings();
  const lower = text.toLocaleLowerCase("tr-TR");
  const rememberMatch = text.match(/^\s*(?:bunu )?hatırla\s*[:：-]\s*(.+)$/i);
  if (rememberMatch) {
    const value = rememberMatch[1].trim();
    const key = `user_note_${Date.now()}`;
    const row = await remember(key, value, "user_note", 4);
    const reply = `Tamam ${s.userName}, bunu hafızama kaydettim.`;
    const [userMsg] = await db.insert(messages).values({ role: "user", content: text, emotion: "focused" }).returning();
    const [assistantMsg] = await db.insert(messages).values({ role: "assistant", content: reply, emotion: "happy" }).returning();
    await db.insert(operations).values({ action: "memory_save", summary: `Kalıcı hafızaya kayıt: ${value.slice(0, 180)}`, status: "success", metadata: { memoryId: row.id } });
    return NextResponse.json({ user: userMsg, assistant: assistantMsg, memory: row });
  }

  if (/(bugün neler yaptık|bugün ne yaptık|günlük rapor|bugünkü rapor)/.test(lower)) {
    const report = await getDailyReport();
    const reply = reportToSpeech(report);
    const [userMsg] = await db.insert(messages).values({ role: "user", content: text, emotion: "focused" }).returning();
    const [assistantMsg] = await db.insert(messages).values({ role: "assistant", content: reply, emotion: "focused" }).returning();
    await db.insert(operations).values({ action: "daily_report", summary: "Günlük rapor Mira tarafından oluşturuldu", status: "success", metadata: report });
    return NextResponse.json({ user: userMsg, assistant: assistantMsg, report });
  }
  const recent = (await db.select().from(messages).orderBy(desc(messages.id)).limit(10)).reverse();
  const memories = await listImportantMemories(20);

  const [userMsg] = await db
    .insert(messages)
    .values({ role: "user", content: text, emotion: detectEmotion(text) })
    .returning();

  const memoryContext = memories.length
    ? memories.map((m) => `- ${m.key}: ${m.value}`).join("\n")
    : "(Henüz kayıtlı önemli hafıza yok.)";

  const { reply, emotion } = await think(
    text,
    recent.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
    s.userName,
    s.persona === "sweet" ? "sweet" : "flirty",
    memoryContext,
  );

  const [assistantMsg] = await db
    .insert(messages)
    .values({ role: "assistant", content: reply, emotion })
    .returning();
  await db.insert(operations).values({ action: "chat", summary: `Mira sohbet yanıtı verdi: ${text.slice(0, 180)}`, status: "success" });

  return NextResponse.json({ user: userMsg, assistant: assistantMsg });
}

export async function DELETE() {
  await db.delete(messages);
  return NextResponse.json({ ok: true });
}
