import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const elevenLabsConfigured = Boolean(
    process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID,
  );

  return NextResponse.json({
    configured: true,
    provider: elevenLabsConfigured ? "elevenlabs" : "edge-tts",
    fallbackProvider: "edge-tts",
    voice: elevenLabsConfigured
      ? process.env.ELEVENLABS_VOICE_ID
      : process.env.EDGE_TTS_VOICE || "tr-TR-EmelNeural",
    model: elevenLabsConfigured
      ? process.env.ELEVENLABS_MODEL_ID || "eleven_v3"
      : "Microsoft Edge Neural TTS (free)",
    needsApiKey: !elevenLabsConfigured,
  });
}
