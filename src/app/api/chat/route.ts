import { NextResponse } from "next/server";
import { think } from "@/lib/brain";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Geçersiz mesaj" }, { status: 400 });
    }

    // /yt-viral: n8n otomasyonunu tetikle
    if (message.startsWith("/yt-viral")) {
      const topic =
        message.replace("/yt-viral", "").trim() ||
        "AI tools and future technology";

      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

      if (!n8nWebhookUrl) {
        return NextResponse.json({
          reply:
            `⚠️ N8N_WEBHOOK_URL ortam değişkeni ayarlanmamış. Analiz edilecek konu: **${topic}**`,
        });
      }

      try {
        const response = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            language: "en",
            requested_by: "Mira Agent",
            timestamp: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          return NextResponse.json({
            reply:
              `🚀 Mira YouTube otomasyonu başlatıldı. Konu: **${topic}**`,
          });
        }

        return NextResponse.json({
          reply: `❌ n8n webhook hata döndürdü: HTTP ${response.status}`,
        });
      } catch (err) {
        return NextResponse.json({
          reply: `❌ n8n bağlantı hatası: ${err instanceof Error ? err.message : "Sunucuya ulaşılamadı"}`,
        });
      }
    }

    // /oku: GitHub'dan dosya oku
    if (message.startsWith("/oku ")) {
      const filePath = message.replace("/oku ", "").trim();
      const token = process.env.GITHUB_TOKEN;
      const repo = process.env.GITHUB_REPO;

      if (!token || !repo) {
        return NextResponse.json({
          reply:
            "GitHub konfigürasyonu (GITHUB_TOKEN veya GITHUB_REPO) eksik.",
        });
      }

      const res = await fetch(
        `https://api.github.com/repos/${repo}/contents/${filePath}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3.raw",
          },
        },
      );

      if (!res.ok) {
        return NextResponse.json({
          reply: `Dosya okunamadı: ${filePath} (HTTP ${res.status})`,
        });
      }

      const fileContent = await res.text();
      return NextResponse.json({
        reply: `\\`\\`\\`\n${fileContent}\n\\`\\`\\``,
      });
    }

    // Genel sohbet:
    // Mira'nın ortak model katmanını kullan. Groq yapılandırılmışsa
    // provider sırasına göre kullanılır; başarısız olursa diğer
    // yapılandırılmış sağlayıcılara otomatik geçilir.
    const result = await think(
      message,
      [],
      "patron",
      "flirty",
      "(Bu istekte özel hafıza özeti sağlanmadı.)",
      "(Bu istekte canlı sistem durum özeti sağlanmadı.)",
    );

    return NextResponse.json({
      reply: result.reply,
      emotion: result.emotion,
    });
  } catch (error) {
    console.error("Mira chat error", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mira sohbet sunucusunda beklenmeyen hata.",
      },
      { status: 500 },
    );
  }
}
