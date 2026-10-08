import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VOICE_ID = "RLMBP8MzrdD3AEkPvkr1";
const MODEL_ID = "eleven_multilingual_v2";
const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

const isPrivateMode = (req: Request) =>
  req.headers.get("cookie")?.split(";").some((part) => part.trim() === "mira_private_mode=1") ?? false;

export async function POST(req: Request) {
  let stage = "request";

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API anahtarı tanımlı değil" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string"
      ? body.text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim()
      : "";

    if (!text) return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Metin çok uzun" }, { status: 413 });

    const privateMode = isPrivateMode(req);
    stage = "elevenlabs-fetch";

    const response = await fetch(ELEVENLABS_URL, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: privateMode ? 0.58 : 0.5,
          similarity_boost: 0.78,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[TTS] ElevenLabs error:", JSON.stringify({
        status: response.status,
        body: errorBody,
        voiceId: VOICE_ID,
        modelId: MODEL_ID,
      }));
      return NextResponse.json(
        { error: `Pınar ses üretimi başarısız: ElevenLabs ${response.status}: ${errorBody}` },
        { status: 502 },
      );
    }

    stage = "audio-read";
    const audio = Buffer.from(await response.arrayBuffer());

    if (!audio.length) {
      throw new Error("ElevenLabs boş ses verisi döndürdü");
    }

    console.log("[TTS] ElevenLabs Pinar output:", JSON.stringify({
      voiceId: VOICE_ID,
      modelId: MODEL_ID,
      contentType: response.headers.get("content-type"),
      bytes: audio.byteLength,
    }));

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type")?.split(";")[0] || "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[TTS] Pinar TTS failed:", JSON.stringify({
      stage,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return NextResponse.json(
      { error: `Pınar ses üretimi başarısız: [${stage}] ${message}` },
      { status: 502 },
    );
  }
}
