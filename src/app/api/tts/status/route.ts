import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const paidTtsAllowed = process.env.MIRA_ALLOW_PAID_TTS === "true";
  const hasApiKey = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  const hasVoiceId = Boolean(process.env.ELEVENLABS_VOICE_ID?.trim());
  const elevenLabsConfigured = paidTtsAllowed && hasApiKey && hasVoiceId;
  const elevenLabsModel = process.env.ELEVENLABS_MODEL_ID || process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

  return NextResponse.json({
    configured: elevenLabsConfigured,
    provider: elevenLabsConfigured ? "elevenlabs" : "not-configured",
    fallbackProvider: null,
    voice: elevenLabsConfigured ? process.env.ELEVENLABS_VOICE_ID : null,
    model: elevenLabsConfigured ? elevenLabsModel : null,
    needsApiKey: !hasApiKey,
    paidProviderEnabled: paidTtsAllowed,
    missing: [
      ...(!paidTtsAllowed ? ["MIRA_ALLOW_PAID_TTS=true"] : []),
      ...(!hasApiKey ? ["ELEVENLABS_API_KEY"] : []),
      ...(!hasVoiceId ? ["ELEVENLABS_VOICE_ID"] : []),
    ],
  });
}
