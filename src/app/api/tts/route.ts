import { NextResponse } from "next/server";
import { EdgeTTS, Constants } from "@andresaya/edge-tts";

export const runtime = "nodejs";

const VOICE = "tr-TR-EmelNeural";

const isPrivateMode = (req: Request) =>
  req.headers.get("cookie")?.split(";").some((part) => part.trim() === "mira_private_mode=1") ?? false;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string"
      ? body.text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim()
      : "";

    if (!text) return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: "Metin çok uzun" }, { status: 413 });

    const privateMode = isPrivateMode(req);
    const tts = new EdgeTTS();
    await tts.synthesize(text, VOICE, {
      rate: privateMode ? "-6%" : "-2%",
      pitch: privateMode ? "-3Hz" : "-1Hz",
      volume: "90%",
      outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    });

    const audio = Buffer.from(await tts.toRaw());
    const hasId3Header =
      audio.length >= 3 &&
      audio[0] === 0x49 &&
      audio[1] === 0x44 &&
      audio[2] === 0x33;
    const hasMpegFrameSync =
      audio.length >= 2 &&
      audio[0] === 0xff &&
      (audio[1] & 0xe0) === 0xe0;
    const detectedFormat = hasId3Header || hasMpegFrameSync ? "MP3" : "unknown";

    console.log(
      "[TTS] Edge TTS output:",
      JSON.stringify({
        contentType: "audio/mpeg",
        format: detectedFormat,
        bytes: audio.byteLength,
        outputFormat: "audio-24khz-96kbitrate-mono-mp3",
        header: audio.subarray(0, 16).toString("hex"),
      }),
    );

    if (detectedFormat !== "MP3") {
      throw new Error(
        `Edge TTS MP3 doğrulaması başarısız: format=${detectedFormat}, bytes=${audio.byteLength}`,
      );
    }

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Emel TTS failed:", error);
    return NextResponse.json({ error: "Emel ses üretimi başarısız" }, { status: 502 });
  }
}
