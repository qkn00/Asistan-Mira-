import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: true,
    provider: "edge-tts",
    voice: process.env.EDGE_TTS_VOICE || "tr-TR-EmelNeural",
    speed: process.env.EDGE_TTS_RATE || "+15%",
    model: "Microsoft Edge Neural TTS (free)",
    needsApiKey: false,
  });
}
