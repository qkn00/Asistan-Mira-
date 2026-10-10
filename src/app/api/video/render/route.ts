import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Caption = { start: number; end: number; text: string };

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

function srtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const mmm = ms % 1000;
  return [hh, mm, ss].map((n) => String(n).padStart(2, "0")).join(":") + "," + String(mmm).padStart(3, "0");
}

function safeCaptions(value: unknown, duration: number): Caption[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const c = item as Record<string, unknown>;
    const start = Number(c.start);
    const end = Number(c.end);
    const text = typeof c.text === "string" ? c.text.replace(/[\r\n]+/g, " ").trim().slice(0, 180) : "";
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) return [];
    const a = Math.max(0, Math.min(duration, start));
    const b = Math.max(0, Math.min(duration, end));
    return b > a ? [{ start: a, end: b, text }] : [];
  });
}

function estimateCaptions(text: string, duration: number): Caption[] {
  const phrases = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+|(?<=,\s)/u)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
  if (!phrases.length) return [];
  const total = phrases.reduce((sum, phrase) => sum + Math.max(1, phrase.length), 0);
  let cursor = 0;
  return phrases.map((phrase) => {
    const start = cursor;
    cursor += duration * Math.max(1, phrase.length) / total;
    return { start, end: Math.min(duration, cursor), text: phrase };
  });
}

function probeAudioDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (!ffmpegPath) return resolve(null);
    const child = spawn(ffmpegPath, ["-hide_banner", "-i", filePath], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    child.on("error", () => resolve(null));
    child.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) return resolve(null);
      const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    });
  });
}

function escapeFilterPath(value: string) {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function runFfmpeg(args: string[], timeoutMs = 100_000) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg çalıştırılabilir dosyası bulunamadı"));
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-6000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Video üretimi zaman aşımına uğradı"));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve();
      reject(new Error("FFmpeg hata verdi: " + stderr.slice(-1800)));
    });
  });
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

  let workDir = "";
  try {
    const body = await req.json();
    if (!Array.isArray(body.images) || body.images.length !== 3) {
      return NextResponse.json({ error: "Tam olarak 3 görsel gerekli" }, { status: 400 });
    }
    const imageInputs = body.images.map((value: unknown, index: number) => {
      const label = "Görsel " + (index + 1);
      if (typeof value !== "string") throw new Error(label + " gerekli");
      const bytes = decodeBase64(value, label, 4 * 1024 * 1024);
      return { bytes, extension: imageExtension(value) };
    });
    const audio = decodeBase64(body.audioBase64, "MP3 ses", 8 * 1024 * 1024);

    workDir = await mkdtemp(path.join(tmpdir(), "mira-mp4-"));
    const imagePaths: string[] = [];
    for (let i = 0; i < imageInputs.length; i++) {
      const imagePath = path.join(workDir, `image-${i + 1}.${imageInputs[i].extension}`);
      await writeFile(imagePath, imageInputs[i].bytes);
      imagePaths.push(imagePath);
    }
    const audioPath = path.join(workDir, "voice.mp3");
    const srtPath = path.join(workDir, "captions.srt");
    const outputPath = path.join(workDir, "mira-short.mp4");
    await writeFile(audioPath, audio);

    // Süre: istemci (TTS kelime zamanlarından) göndermediyse gerçek ses dosyasından ölç.
    const requested = Number(body.durationSeconds);
    const probed = await probeAudioDuration(audioPath);
    const base = Number.isFinite(requested) && requested > 0 ? requested : (probed ?? 20);
    const duration = Math.max(4, Math.min(90, base + 0.4));
    const captions = safeCaptions(body.captions, duration);
    const finalCaptions = captions.length
      ? captions
      : (typeof body.narrationText === "string" ? estimateCaptions(body.narrationText.slice(0, 5000), duration) : []);
    if (!finalCaptions.length) {
      return NextResponse.json({ error: "Altyazı için captions zamanları veya narrationText gerekli" }, { status: 400 });
    }
    const srt = finalCaptions.map((caption, index) =>
      `${index + 1}\n${srtTime(caption.start)} --> ${srtTime(caption.end)}\n${caption.text}\n`
    ).join("\n");
    await writeFile(srtPath, srt, "utf8");

    const segment = duration / 3;
    const filters = imagePaths.map((_, index) =>
      `[${index}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0005,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1[v${index}]`
    );
    // libass'ın FontSize/MarginV değerleri PlayResY=288 birimindedir; 1080x1920'e ölçeklenir.
    // fontsdir: Railway imajında sistem fontu bulunmayabileceğinden proje içi font klasörünü kullan.
    const fontsDir = path.join(process.cwd(), "public", "fonts");
    const subtitleStyle = "FontName=DejaVu Sans,FontSize=17,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=34";
    filters.push(`[v0][v1][v2]concat=n=3:v=1:a=0,subtitles=${escapeFilterPath(srtPath)}:fontsdir='${escapeFilterPath(fontsDir)}':force_style='${subtitleStyle}'[vout]`);

    const args = ["-hide_banner", "-loglevel", "error", "-y"];
    for (const imagePath of imagePaths) {
      args.push("-loop", "1", "-framerate", "30", "-t", String(segment), "-i", imagePath);
    }
    args.push("-i", audioPath);
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[vout]", "-map", "3:a",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "128k", "-af", "apad",
      "-t", String(duration), "-movflags", "+faststart",
      outputPath,
    );

    await runFfmpeg(args);
    const video = await readFile(outputPath);
    if (video.length < 10_000 || video.subarray(4, 8).toString("ascii") !== "ftyp") {
      throw new Error("Üretilen dosya geçerli MP4 olarak doğrulanamadı");
    }

    console.log("[Mira MP4] render success", JSON.stringify({
      bytes: video.length,
      durationSeconds: duration,
      images: imagePaths.length,
      captions: finalCaptions.length,
    }));
    return new Response(new Uint8Array(video), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.length),
        "Content-Disposition": 'attachment; filename="mira-short.mp4"',
        "Cache-Control": "no-store",
        "X-Mira-Render": "success",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Mira MP4] render failed:", message);
    return NextResponse.json({ ok: false, error: message.slice(0, 800) }, { status: 500 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
