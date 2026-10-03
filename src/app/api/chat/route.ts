import { NextResponse } from 'next/server';
import { getFileContent, createPR } from '@/lib/github';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userMessage = (body.message || body.prompt || body.content || '').toString().trim();

    if (!userMessage) {
      return NextResponse.json({ reply: "Boş mesaj gönderilemez." }, { status: 400 });
    }

    if (userMessage.startsWith('/oku')) {
      const filePath = userMessage.replace('/oku', '').trim();
      if (!filePath) {
        return NextResponse.json({ reply: "Lütfen okunacak dosya yolunu belirtin. Örn: `/oku package.json`" });
      }
      try {
        const content = await getFileContent(filePath);
        return NextResponse.json({ reply: `📄 **${filePath} İçeriği:**\n\n\`\`\`json\n${content}\n\`\`\`` });
      } catch (err: any) {
        return NextResponse.json({ reply: `❌ Dosya okunamadı: ${err.message}` });
      }
    }

    if (userMessage === '/pr-test') {
      try {
        const prUrl = await createPR(
          `test-${Date.now()}.txt`,
          'Mira Otonom Test İçeriği',
          'Mira Otonom PR Testi'
        );
        return NextResponse.json({ reply: `🚀 **PR Başarıyla Oluşturuldu:** ${prUrl}` });
      } catch (err: any) {
        return NextResponse.json({ reply: `❌ PR hatası: ${err.message}` });
      }
    }

    return NextResponse.json({ reply: "Komut algılanamadı." });
  } catch (error: any) {
    return NextResponse.json({ reply: `❌ Sunucu hatası: ${error.message}` }, { status: 500 });
  }
}
