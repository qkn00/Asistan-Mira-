import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

const isPrivateMode = (req: Request) =>
  req.headers.get("cookie")?.split(";").some((part) => part.trim() === "mira_private_mode=1") ?? false;

export async function POST(req: Request) {
  let stage = "request";

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      return NextResponse.json(
        { error: "ElevenLabs bağlantısı için ELEVENLABS_API_KEY ve ELEVENLABS_VOICE_ID tanımlanmalı" },
        { status: 503 },
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

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
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
        voiceId,
        modelId: MODEL_ID,
      }));
      return NextResponse.json(
        { error: `Mira ses üretimi başarısız: ElevenLabs ${response.status}: ${errorBody}` },
        { status: 502 },
      );
    }

    stage = "audio-read";
    const audio = Buffer.from(await response.arrayBuffer());

    if (!audio.length) throw new Error("ElevenLabs boş ses verisi döndürdü");

    console.log("[TTS] Mira ElevenLabs output:", JSON.stringify({
      voiceId,
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
    console.error("[TTS] Mira TTS failed:", JSON.stringify({
      stage,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return NextResponse.json(
      { error: `Mira ses üretimi başarısız: [${stage}] ${message}` },
      { status: 502 },
    );
  }
}
