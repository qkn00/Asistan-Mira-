import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ELEVEN_API = "https://api.elevenlabs.io/v1/text-to-speech";

type SolMode = "sweet" | "flirty" | "serious" | "excited" | "close";

const profiles: Record<SolMode, {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
}> = {
  sweet:   { stability: 0.48, similarity_boost: 0.82, style: 0.10, speed: 0.98 },
  flirty:  { stability: 0.38, similarity_boost: 0.84, style: 0.18, speed: 0.96 },
  serious: { stability: 0.68, similarity_boost: 0.86, style: 0.02, speed: 0.98 },
  excited: { stability: 0.32, similarity_boost: 0.82, style: 0.22, speed: 1.06 },
  close:   { stability: 0.52, similarity_boost: 0.84, style: 0.08, speed: 0.97 },
};

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return NextResponse.json(
      { error: "ElevenLabs yapılandırılmamış", fallback: true },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mode = (body.solMode as SolMode) in profiles ? (body.solMode as SolMode) : "close";

  if (!text) return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Metin çok uzun" }, { status: 413 });

  const p = profiles[mode];

  try {
    const response = await fetch(
      `${ELEVEN_API}/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
          voice_settings: p,
          ...(process.env.ELEVENLABS_MODEL === "eleven_multilingual_v2" ? {} : { language_code: "tr" }),
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("ElevenLabs TTS failed:", response.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "ElevenLabs ses üretimi başarısız", fallback: true },
        { status: 502 },
      );
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("ElevenLabs TTS request failed:", error);
    return NextResponse.json(
      { error: "ElevenLabs bağlantısı kurulamadı", fallback: true },
      { status: 502 },
    );
  }
}
