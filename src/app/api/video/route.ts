import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GENERATION_TIMEOUT_MS = 180000;
const POLL_INTERVAL_MS = 3000;

async function requestJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 30000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    const apiUrl = process.env.WAN_API_URL?.trim().replace(/\/$/, "");

    if (!apiUrl) {
      return NextResponse.json(
        {
          error:
            "WAN_API_URL ortam değişkeni eksik. Kaggle/Cloudflare Wan2.1 API adresini Railway'e ekle.",
        },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Video promptu gerekli." }, { status: 400 });
    }

    const startResponse = await requestJson(
      `${apiUrl}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "9:16",
          duration: 5,
          negative_prompt: "",
          seed: -1,
        }),
      },
      30000,
    );

    if (!startResponse.ok) {
      const detail = await startResponse.text();
      return NextResponse.json(
        { error: `Wan2.1 üretim isteği başarısız: ${detail.slice(0, 500)}` },
        { status: 502 },
      );
    }

    const started = (await startResponse.json()) as {
      job_id?: string;
    };

    if (!started.job_id) {
      return NextResponse.json(
        { error: "Wan2.1 API job_id döndürmedi." },
        { status: 502 },
      );
    }

    const deadline = Date.now() + GENERATION_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const statusResponse = await requestJson(
        `${apiUrl}/status/${encodeURIComponent(started.job_id as string)}`,
        undefined,
        30000,
      );

      if (!statusResponse.ok) {
        const detail = await statusResponse.text();
        return NextResponse.json(
          { error: `Wan2.1 durum sorgusu başarısız: ${detail.slice(0, 500)}` },
          { status: 502 },
        );
      }

      const status = (await statusResponse.json()) as {
        status?: string;
        filename?: string;
        error?: string;
      };

      if (status.status === "failed") {
        return NextResponse.json(
          { error: `Wan2.1 video üretimi başarısız: ${status.error ?? "bilinmeyen hata"}` },
          { status: 502 },
        );
      }

      if (status.status === "completed" && status.filename) {
        const videoUrl = `${apiUrl}/video/${encodeURIComponent(status.filename)}`;

        return NextResponse.json({
          ok: true,
          provider: "Wan2.1",
          model: "Wan2.1-T2V-1.3B",
          videoUrl,
          jobId: started.job_id,
          duration: 5,
          aspectRatio: "9:16",
          verified: true,
        });
      }
    }

    return NextResponse.json(
      {
        error:
          "Wan2.1 video üretimi zaman aşımına uğradı. GPU oturumunu ve Cloudflare tünelini kontrol et.",
        jobId: started.job_id,
      },
      { status: 504 },
    );
  } catch (error) {
    console.error("Mira Wan2.1 video generation failed:", error);
    const reason = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `Video üretimi başarısız: ${reason.slice(0, 500)}` },
      { status: 502 },
    );
  }
}
