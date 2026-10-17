import { isMiraSessionCookie } from "@/lib/mira-auth";
import { NextResponse } from "next/server";
import { downloadDriveFile, listDriveFolderFiles } from "@/lib/google-drive";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: Request) {
  return isMiraSessionCookie(req.headers.get("cookie"));
}

function isVideoName(name: string) {
  return /^(?:video|uzun_video)_\d+\.mp4$/i.test(name);
}

type VideoInspection = {
  ok: boolean;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean | null;
  shortsTargetMatch: boolean;
  error?: string;
};

async function inspectVideo(data: Buffer, name: string): Promise<VideoInspection> {
  if (!ffmpegPath) {
    return { ok: false, durationSeconds: null, width: null, height: null, fps: null, hasAudio: null, shortsTargetMatch: false, error: "ffmpeg-static ikilisi sunucuda bulunamadı." };
  }
  let dir = "";
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "mira-video-check-"));
    const filePath = path.join(dir, name.replace(/[^a-zA-Z0-9._-]/g, "_") || "video.mp4");
    await writeFile(filePath, data);
    const stderr = await new Promise<string>((resolve, reject) => {
      const child = spawn(ffmpegPath, ["-hide_banner", "-i", filePath], { stdio: ["ignore", "ignore", "pipe"] });
      let output = "";
      const timeout = setTimeout(() => child.kill("SIGKILL"), 20000);
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => { output += chunk; });
      child.on("error", (error) => { clearTimeout(timeout); reject(error); });
      child.on("close", () => {
        clearTimeout(timeout);
        // ffmpeg exits non-zero when no output target is supplied; input metadata is still printed.
        resolve(output);
      });
    });
    const durationMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
    const videoLine = stderr.split(/\r?\n/).find((line) => /Video:/i.test(line)) || "";
    const dimensionsMatch = videoLine.match(/(?:^|\s)(\d{2,5})x(\d{2,5})(?:\s|,|$)/);
    const fpsMatch = videoLine.match(/(\d+(?:\.\d+)?)\s*fps\b/i);
    const audio = /Audio:/i.test(stderr);
    const durationSeconds = durationMatch
      ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
      : null;
    const width = dimensionsMatch ? Number(dimensionsMatch[1]) : null;
    const height = dimensionsMatch ? Number(dimensionsMatch[2]) : null;
    const fps = fpsMatch ? Number(fpsMatch[1]) : null;
    const ok = durationSeconds !== null && Number.isFinite(durationSeconds) && width !== null && height !== null;
    return {
      ok,
      durationSeconds,
      width,
      height,
      fps,
      hasAudio: audio,
      shortsTargetMatch: ok && durationSeconds! >= 20 && durationSeconds! <= 30 && width === 1080 && height === 1920 && fps !== null && Math.abs(fps - 30) < 0.1,
      error: ok ? undefined : stderr.slice(-1200) || "FFmpeg video akışı için süre/çözünürlük bilgisi çıkaramadı.",
    };
  } catch (error) {
    return { ok: false, durationSeconds: null, width: null, height: null, fps: null, hasAudio: null, shortsTargetMatch: false, error: (error instanceof Error ? error.message : "FFmpeg analiz hatası").slice(0, 500) };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function testFile(file: Awaited<ReturnType<typeof listDriveFolderFiles>>[number]) {
  try {
    const expectedBytes = Number(file.size || 0);
    const downloaded = await downloadDriveFile(file.id);
    const actualBytes = downloaded.data.length;
    const brand = actualBytes >= 8 ? downloaded.data.subarray(4, 8).toString("ascii") : "";
    const mp4SignatureValid = actualBytes >= 12 && brand === "ftyp";
    const exactSizeMatch = expectedBytes > 0 && actualBytes === expectedBytes;
    const technical = await inspectVideo(downloaded.data, downloaded.name);
    const passed = actualBytes > 0 && exactSizeMatch && mp4SignatureValid && downloaded.mimeType === "video/mp4" && technical.ok;
    return {
      ok: passed,
      technical,
      shortsTargetMatch: technical.shortsTargetMatch,
      name: file.name,
      expectedBytes,
      actualBytes,
      exactSizeMatch,
      mimeType: downloaded.mimeType,
      mp4SignatureValid,
      error: passed ? undefined : (!technical.ok ? `FFmpeg teknik analizi başarısız: ${technical.error || "video bilgileri okunamadı"}` : "Boyut, MIME türü veya MP4 imzası doğrulanamadı."),
    };
  } catch (error) {
    return {
      ok: false,
      name: file.name,
      expectedBytes: Number(file.size || 0),
      actualBytes: 0,
      exactSizeMatch: false,
      mimeType: file.mimeType,
      mp4SignatureValid: false,
      technical: { ok: false, durationSeconds: null, width: null, height: null, fps: null, hasAudio: null, shortsTargetMatch: false, error: "Teknik analiz çalıştırılamadı." },
      shortsTargetMatch: false,
      error: (error instanceof Error ? error.message : "Bilinmeyen Drive hatası").slice(0, 300),
    };
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Mira giriş oturumu gerekli." }, { status: 401 });
  }

  const url = new URL(req.url);
  const requestedName = url.searchParams.get("file") || "video_1.mp4";
  const testAll = url.searchParams.get("all") === "1";

  if (!testAll && !isVideoName(requestedName)) {
    return NextResponse.json({ ok: false, error: "Geçersiz dosya adı." }, { status: 400 });
  }

  try {
    const files = await listDriveFolderFiles();
    const videos = files.filter((item) => isVideoName(item.name));
    if (testAll) {
      if (!videos.length) {
        return NextResponse.json({ ok: false, error: "Drive klasöründe MP4 video bulunamadı.", results: [] }, { status: 404 });
      }
      const results = [];
      for (const file of videos) results.push(await testFile(file));
      const passed = results.filter((item) => item.ok).length;
      const failed = results.length - passed;
      return NextResponse.json({
        ok: failed === 0,
        test: "drive-download-all-videos",
        total: results.length,
        passed,
        failed,
        results,
        message: failed === 0
          ? "Drive klasöründeki tüm MP4 videolar indirildi; dosya bütünlüğü ve teknik video bilgileri doğrulandı."
          : "Bazı videoların dosya bütünlüğü veya teknik bilgileri doğrulanamadı. Ayrıntılar results bölümünde.",
      }, { status: failed === 0 ? 200 : 422 });
    }

    const file = videos.find((item) => item.name.toLowerCase() === requestedName.toLowerCase());
    if (!file) {
      return NextResponse.json({
        ok: false,
        error: `${requestedName} Drive klasöründe bulunamadı.`,
        availableVideoNames: videos.map((item) => item.name),
      }, { status: 404 });
    }
    const result = await testFile(file);
    return NextResponse.json({
      ...result,
      test: `drive-download-${requestedName}`,
      downloadHttpStatus: result.ok ? 200 : 422,
      message: result.ok
        ? "Drive dosyası indirildi; boyut, MIME, MP4 imzası ve video teknik bilgileri doğrulandı."
        : result.error || result.technical?.error,
    }, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen Drive hatası";
    const match = message.match(/HTTP\s+(\d{3})/i);
    return NextResponse.json({
      ok: false,
      test: testAll ? "drive-download-all-videos" : `drive-download-${requestedName}`,
      downloadHttpStatus: match ? Number(match[1]) : null,
      error: message.slice(0, 400),
    }, { status: 502 });
  }
}
