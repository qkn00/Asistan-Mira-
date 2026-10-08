import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(
    process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID,
  );

  return NextResponse.json({
    configured,
    provider: configured ? "elevenlabs" : "unconfigured",
    model: configured
      ? process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2"
      : null,
  });
}
