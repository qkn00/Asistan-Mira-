import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
  return NextResponse.json({
    configured,
    provider: configured ? "elevenlabs" : "browser-fallback",
    model: configured ? (process.env.ELEVENLABS_MODEL || "eleven_v3") : null,
  });
}
