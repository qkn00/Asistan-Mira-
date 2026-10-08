import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const XAI_VOICE_ID = process.env.XAI_VOICE_ID || "ara";
const XAI_TTS_SPEED = Number(process.env.XAI_TTS_SPEED || "1.15");

const isPrivateMode = (req: Request) =>
  req.headers.get("cookie")?.split(";").some((part) => part.trim() === "mira_private_mode=1") ?? false;

export async function POST(req: Request) {
  let stage = "request";

  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string"
      ? body.text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim()
      : "";

    if (!text) return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Metin çok uzun" }, { status: 413 });

    const xaiKey = process.env.XAI_API_KEY;

    // Mira's preferred voice: xAI/Grok Ara, slightly faster than normal.
    if (xaiKey) {
      stage = "xai-tts-fetch";
      const response = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${xaiKey}`,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          voice_id: XAI_VOICE_ID,
          language: "tr",
          speed: Number.isFinite(XAI_TTS_SPEED) ? Math.min(1.5, Math.max(0.7, XAI_TTS_SPEED)) : 1.15,
          output_format: { codec: "mp3", sample_rate: 44100, bit_rate: 128000 },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[TTS] xAI error:", JSON.stringify({ status: response.status, body: errorBody, voiceId: XAI_VOICE_ID }));
        return NextResponse.json(
          { error: `Mira ses üretimi başarısız: xAI ${response.status}: ${errorBody}` },
          { status: 502 },
        );
      }

      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.length) throw new Error("xAI boş ses verisi döndürdü");

      console.log("[TTS] Mira xAI output:", JSON.stringify({
        voiceId: XAI_VOICE_ID,
        speed: XAI_TTS_SPEED,
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
    }

    // Keep the existing ElevenLabs path working until XAI_API_KEY is added.
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      return NextResponse.json(
        { error: "Ara sesini etkinleştirmek için Railway Variables bölümüne XAI_API_KEY eklenmeli. Alternatif olarak ELEVENLABS_API_KEY ve ELEVENLABS_VOICE_ID tanımlanmalı." },
        { status: 503 },
      );
    }

    const privateMode = isPrivateMode(req);
    stage = "elevenlabs-fetch";
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL_ID,
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
      console.error("[TTS] ElevenLabs error:", JSON.stringify({ status: response.status, body: errorBody, voiceId, modelId: ELEVENLABS_MODEL_ID }));
      return NextResponse.json(
        { error: `Mira ses üretimi başarısız: ElevenLabs ${response.status}: ${errorBody}` },
        { status: 502 },
      );
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error("ElevenLabs boş ses verisi döndürdü");

    console.log("[TTS] Mira ElevenLabs output:", JSON.stringify({
      voiceId,
      modelId: ELEVENLABS_MODEL_ID,
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
