import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Free default: Microsoft Edge neural TTS. Paid providers are not called automatically.
const EDGE_TTS_VOICE = process.env.EDGE_TTS_VOICE;
const EDGE_TTS_RATE = process.env.EDGE_TTS_RATE || "-10%";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string"
      ? body.text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim()
      : "";

    if (!text) return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Metin çok uzun" }, { status: 413 });

    if (!EDGE_TTS_VOICE) {
      return NextResponse.json(
        { error: "Mira için ses seçilmemiş. EDGE_TTS_VOICE ayarlanmadan varsayılan bir ses kullanılmayacak." },
        { status: 503 },
      );
    }

    const { EdgeTTS } = await import("@andresaya/edge-tts");
    const tts = new EdgeTTS();

    await tts.synthesize(text, EDGE_TTS_VOICE, {
      rate: EDGE_TTS_RATE,
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    });

    const audio = tts.toBuffer();
    if (!audio || audio.length === 0) {
      throw new Error("Edge TTS boş ses verisi döndürdü");
    }

    console.log("[TTS] Mira free Edge TTS output:", JSON.stringify({
      voice: EDGE_TTS_VOICE,
      rate: EDGE_TTS_RATE,
      bytes: audio.length,
    }));

    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[TTS] Mira Edge TTS failed:", message);
    return NextResponse.json(
      { error: `Mira ücretsiz ses üretimi başarısız: ${message}` },
      { status: 502 },
    );
  }
}
