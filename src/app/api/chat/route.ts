import { NextResponse } from 'next/server';
import { getFileContent } from '@/lib/github';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Geçersiz mesaj' }, { status: 400 });
    }

    // Slash Komutu Kontrolü: /oku <dosya_yolu>
    if (message.startsWith('/oku')) {
      const filePath = message.replace('/oku', '').trim();
      if (!filePath) {
        return NextResponse.json({ reply: 'Lütfen okunacak dosya yolunu belirtin. Örn: /oku package.json' });
      }

      try {
        const content = await getFileContent(filePath);
        return NextResponse.json({ reply: `\`\`\`json\n${content}\n\`\`\`` });
      } catch (err: any) {
        return NextResponse.json({ reply: `Dosya okunurken hata oluştu: ${err.message || 'Dosya bulunamadı.'}` });
      }
    }

    // Normal Sohbet Yanıtı
    return NextResponse.json({ reply: `Mira: "${message}" mesajınızı aldı.` });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Sunucu hatası oluştu' }, { status: 500 });
  }
}
