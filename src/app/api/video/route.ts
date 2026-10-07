import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";

const MODEL = "fal-ai/kling-video/o3/standard/text-to-video";

export async function POST(req: Request) {
  try {
    const key = process.env.FAL_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "FAL_KEY ortam değişkeni eksik. Railway'e fal.ai API anahtarını ekle." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Video promptu gerekli." }, { status: 400 });
    }

    fal.config({ credentials: key });

    const result = await fal.subscribe(MODEL, {
      input: {
        prompt,
        duration: "12",
        aspect_ratio: "9:16",
        generate_audio: true,
      },
      logs: true,
    });

    const video = result.data?.video;
    if (!video?.url) {
      return NextResponse.json(
        { error: "Video üretimi tamamlandı ancak video URL'si dönmedi." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: "fal.ai",
      model: MODEL,
      videoUrl: video.url,
      requestId: result.requestId,
    });
  } catch (error) {
    console.error("Mira video generation failed:", error);
    const reason = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Video üretimi başarısız: ${reason.slice(0, 500)}` },
      { status: 502 },
    );
  }
}
