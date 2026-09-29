import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ELEVEN_API = "https://api.elevenlabs.io/v1/text-to-speech";
// Mira'nın varsayılan sesi: Pelin Yıldız.
const DEFAULT_VOICE_ID = "FvxJI7vwUDkTkEOO7nd7";

type SolMode = "sweet" | "flirty" | "serious" | "excited" | "close";
type Emotion = "happy" | "surprised" | "sad" | "playful" | "focused";

const profiles: Record<SolMode, {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  tag: string;
}> = {
  sweet:   { stability: 0.42, similarity_boost: 0.84, style: 0.18, speed: 0.98, tag: "[warmly]" },
  flirty:  { stability: 0.34, similarity_boost: 0.84, style: 0.28, speed: 0.97, tag: "[mischievously]" },
  serious: { stability: 0.60, similarity_boost: 0.88, style: 0.06, speed: 0.98, tag: "[serious]" },
  excited: { stability: 0.30, similarity_boost: 0.82, style: 0.32, speed: 1.05, tag: "[excited]" },
  close:   { stability: 0.46, similarity_boost: 0.85, style: 0.16, speed: 0.97, tag: "[softly]" },
};

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  if (!apiKey || !voiceId) {
    return NextResponse.json(
      { error: "ElevenLabs yapılandırılmamış", fallback: true },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  const mode = (body.solMode as SolMode) in profiles ? (body.solMode as SolMode) : "close";
  const emotion = (body.emotion as Emotion) in { happy: 1, surprised: 1, sad: 1, playful: 1, focused: 1 }
    ? (body.emotion as Emotion)
    : "happy";
  const text = rawText
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!text) return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "Metin çok uzun" }, { status: 413 });

  const p = profiles[mode];
  const model = process.env.ELEVENLABS_MODEL || "eleven_v3";
  const emotionTag: Record<Emotion, string> = {
    happy: "[happily]",
    surprised: "[surprised]",
    sad: "[sorrowful]",
    playful: "[playfully]",
    focused: "[calm]",
  };
  const modeTag: Record<SolMode, string> = {
    sweet: "[warmly]",
    flirty: "[playfully]",
    serious: "[calm]",
    excited: "[excited]",
    close: "[softly]",
  };
  const ttsText = model === "eleven_v3"
    ? `${emotionTag[emotion]} ${modeTag[mode]} ${text}`
    : text;

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
          text: ttsText,
          model_id: model,
          voice_settings: {
            stability: p.stability,
            similarity_boost: p.similarity_boost,
            style: p.style,
            speed: p.speed,
            use_speaker_boost: true,
          },
          language_code: "tr",
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
