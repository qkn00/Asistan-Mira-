import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const xaiConfigured = Boolean(process.env.XAI_API_KEY);
  const elevenLabsConfigured = Boolean(
    process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID,
  );
  const configured = xaiConfigured || elevenLabsConfigured;

  return NextResponse.json({
    configured,
    provider: xaiConfigured ? "xai" : elevenLabsConfigured ? "elevenlabs" : "unconfigured",
    voice: xaiConfigured ? process.env.XAI_VOICE_ID || "ara" : null,
    speed: xaiConfigured
      ? Number(process.env.XAI_TTS_SPEED || "1.15")
      : null,
    model: xaiConfigured
      ? "xAI TTS"
      : elevenLabsConfigured
        ? process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2"
        : null,
    needsXaiApiKey: !xaiConfigured,
  });
}
