import { think } from '../../../lib/brain';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Geçersiz mesaj' }, { status: 400 });
    }

    // Yardım ve sistem komutları
    const command = message.trim().split(/\s+/)[0].toLocaleLowerCase('tr-TR');

    if (command === '/yardım' || command === '/komutlar' || command === '/help') {
      return NextResponse.json({
        reply: [
          'Komutlarım:',
          '',
          '/yardım — Bu komut listesini gösterir.',
          '/durum — Mira backend ve veritabanı sağlık durumunu kontrol eder.',
          '/n8n — n8n bağlantı durumunu kontrol eder.',
          '/yt-viral <konu> — YouTube Shorts otomasyonunu başlatır.',
          '/oku <dosya> — GitHub reposundaki dosyayı okur.',
        ].join('\\n'),
        emotion: 'focused',
      });
    }

    if (command === '/durum') {
      try {
        await db.execute(sql`select 1`);
        return NextResponse.json({
          reply: 'Sistem ayakta. Backend: aktif. Veritabanı: bağlı ve doğrulandı.',
          emotion: 'focused',
        });
      } catch (error) {
        console.error('Mira /durum database health check failed:', error);
        return NextResponse.json({
          reply: 'Backend aktif, ancak veritabanı bağlantısı şu anda doğrulanamadı.',
          emotion: 'focused',
        });
      }
    }

    if (command === '/n8n-ajan') {
      const agentName = message.trim().replace(/^\/n8n-ajan\s*/i, '').trim() || 'Mira n8n Ajanı';
      return NextResponse.json({
        reply: `n8n ajanı oluşturma isteği hazırlandı: “${agentName}”. Şu an yalnızca bu komutun kendisini oluşturdum; n8n tarafında gerçek ajan/workflow oluşturulduğu henüz doğrulanmadı. Bir sonraki adımda bu komutu gerçek n8n oluşturma webhook'una bağlayabiliriz.`,
        emotion: 'focused',
      });
    }

    if (command === '/n8n') {
      try {
        const base = new URL(req.url).origin;
        const status = await fetch(`${base}/api/automation/n8n-status`, { cache: 'no-store' });
        const data = await status.json().catch(() => ({}));
        return NextResponse.json({
          reply: data.reachable
            ? 'n8n sunucusuna canlı erişim doğrulandı.'
            : 'n8n sunucusuna canlı erişimi doğrulayamadım.',
          emotion: 'focused',
        });
      } catch {
        return NextResponse.json({ reply: 'n8n durumunu şu anda doğrulayamıyorum.', emotion: 'focused' });
      }
    }

    // /yt-viral komutu kontrolü (n8n İngilizce Video Otomasyonu Tetikleyici)
    if (message.startsWith('/yt-viral')) {
      const topic = message.replace('/yt-viral', '').trim() || 'AI tools and future technology';
      
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

      if (!n8nWebhookUrl) {
        return NextResponse.json({
          reply: `⚠️ **N8N_WEBHOOK_URL** ortam değişkeni ayarlanmamış. Lütfen Railway paneline n8n webhook linkinizi ekleyin.\n\nAnaliz edilecek konu: **${topic}**`
        });
      }

      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic,
            language: 'en',
            requested_by: 'Mira Agent',
            timestamp: new Date().toISOString()
          }),
        });

        if (response.ok) {
          return NextResponse.json({
            reply: `🚀 **Mira YouTube Otomasyonu Başlatıldı!**\n\n- **Aranan Konu:** ${topic}\n- **Hedef Kitle:** İngilizce / Global (US)\n- **İşlem:** YouTube Data API ile trendler çekiliyor, yapay zekâ ile senaryo yazılıp ElevenLabs/Edge-TTS & Pexels ile video renderlanıyor.`
          });
        } else {
          return NextResponse.json({
            reply: `❌ n8n sunucusuna bağlanırken hata oluştu (Status: ${response.status}). Webhook adresinizi kontrol edin.`
          });
        }
      } catch (err: any) {
        return NextResponse.json({
          reply: `❌ n8n bağlantı hatası: ${err.message || 'Sunucuya ulaşılamadı'}`
        });
      }
    }

    // /oku komutu kontrolü
    if (message.startsWith('/oku ')) {
      const filePath = message.replace('/oku ', '').trim();
      const token = process.env.GITHUB_TOKEN;
      const repo = process.env.GITHUB_REPO;

      if (!token || !repo) {
        return NextResponse.json({
          reply: 'GitHub konfigürasyonu (GITHUB_TOKEN veya GITHUB_REPO) ortam değişkenlerinde eksik.',
        });
      }

      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3.raw',
        },
      });

      if (!res.ok) {
        return NextResponse.json({
          reply: `Dosya okunamadı veya bulunamadı: ${filePath} (Status:${res.status})`,
        });
      }

      const fileContent = await res.text();
      return NextResponse.json({
        reply: "```\n" + fileContent + "\n```",
      });
    }

    const result = await think(message, [], "", "flirty");
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sunucu hatası' }, { status: 500 });
  }
}
