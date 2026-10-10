import { NextResponse } from "next/server";
import { renderShort } from "@/lib/render-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request) {
  const expected = process.env.MIRA_AUTOMATION_SECRET || process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

function decodeBase64(value: unknown, label: string, maxBytes: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(label + " gerekli");
  }
  const raw = value.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw) || raw.length % 4 === 1) {
    throw new Error(label + " geçerli base64 değil");
  }
  if (raw.length > Math.ceil(maxBytes * 4 / 3) + 8) {
    throw new Error(label + " dosyası çok büyük");
  }
  const bytes = Buffer.from(raw, "base64");
  if (!bytes.length || bytes.length > maxBytes) {
    throw new Error(label + " dosyası boş veya çok büyük");
  }
  return bytes;
}

function imageExtension(value: string) {
  const match = value.match(/^data:image\/(png|jpe?g|webp);base64,/i);
  if (!match) return "jpg";
  return match[1].toLowerCase().replace("jpeg", "jpg");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mira-mp4-renderer",
    durationSeconds: "otomatik (durationSeconds parametresi veya ses dosyasından ölçülür)",
    resolution: "1080x1920",
    fps: 30,
    accepts: "3 base64 images, MP3 audio, optional timed captions",
  });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  try {
    const body = await req.json();
    if (!Array.isArray(body.images) || body.images.length !== 3) {
      return NextResponse.json({ error: "Tam olarak 3 görsel gerekli" }, { status: 400 });
    }
    const images = body.images.map((value: unknown, index: number) => {
      if (typeof value !== "string") throw new Error(`Görsel ${index + 1} gerekli`);
      return {
        bytes: decodeBase64(value, `Görsel ${index + 1}`, 4 * 1024 * 1024),
        extension: imageExtension(value),
      };
    });

    const { video, durationSeconds } = await renderShort({
      images,
      audio: decodeBase64(body.audioBase64, "MP3 ses", 8 * 1024 * 1024),
      captions: body.captions,
      narrationText: body.narrationText,
      durationSeconds: body.durationSeconds,
    });

    return new Response(new Uint8Array(video), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.length),
        "Content-Disposition": 'attachment; filename="mira-short.mp4"',
        "Cache-Control": "no-store",
        "X-Mira-Render": "success",
        "X-Mira-Duration": String(durationSeconds),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Mira MP4] render failed:", message);
    return NextResponse.json({ ok: false, error: message.slice(0, 800) }, { status: 500 });
  }
}
