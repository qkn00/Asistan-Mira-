import { NextResponse } from "next/server";
import { generateCivitaiImage } from "@/lib/civitai";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "prompt gerekli" }, { status: 400 });
    }

    const result = await generateCivitaiImage({
      prompt,
      aspectRatio: body.aspectRatio,
      size: body.size,
      creativity: body.creativity,
      quantity: body.quantity,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Mira Civitai image generation failed:", reason);
    return NextResponse.json(
      { ok: false, error: reason.slice(0, 600) },
      { status: 502 },
    );
  }
}
