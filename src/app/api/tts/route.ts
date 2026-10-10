import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EDGE_TTS_VOICE = process.env.EDGE_TTS_VOICE || "tr-TR-EmelNeural";
const EDGE_TTS_RATE = process.env.EDGE_TTS_RATE || "-10%";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";

function audioResponse(audio: ArrayBuffer | Uint8Array, provider: string) {
  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
  if (!bytes.length) throw new Error(provider + " boş ses verisi döndürdü");
  console.log("[TTS] Audio generated:", JSON.stringify({ provider, bytes: bytes.length }));
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new NextResponse(body as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
      "X-Mira-TTS-Provider": provider,
    },
  });
}

async function generateWithElevenLabs(text: string) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    throw new Error("ElevenLabs API key veya voice ID ayarlı değil");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL_ID,
        language_code: "tr",
      }),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`ElevenLabs HTTP ${response.status}: ${detail}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("audio/")) {
    throw new Error("ElevenLabs ses yerine beklenmeyen veri döndürdü");
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function generateWithEdgeTTS(text: string) {
  const { EdgeTTS } = await import("@andresaya/edge-tts");
  const tts = new EdgeTTS();
  await tts.synthesize(text, EDGE_TTS_VOICE, {
    rate: EDGE_TTS_RATE,
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
  });
  return tts.toBuffer();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string"
      ? body.text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim()
      : "";

    if (!text) return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Metin çok uzun" }, { status: 413 });

    if (ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID) {
      try {
        const audio = await generateWithElevenLabs(text);
        return audioResponse(audio, "elevenlabs:" + ELEVENLABS_MODEL_ID);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[TTS] ElevenLabs failed; trying Edge TTS fallback:", message);
      }
    } else {
      console.warn("[TTS] ElevenLabs key or voice ID missing; using Edge TTS fallback");
    }

    try {
      const audio = await generateWithEdgeTTS(text);
      return audioResponse(audio, "edge-tts");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[TTS] Edge TTS fallback failed:", message);
      return NextResponse.json(
        { error: "ElevenLabs ve yedek ses üretimi başarısız oldu." },
        { status: 502 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[TTS] Request failed:", message);
    return NextResponse.json({ error: "Ses üretim isteği işlenemedi." }, { status: 500 });
  }
}
