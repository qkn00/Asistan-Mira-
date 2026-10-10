// Render endpoint e2e testi: gerçek assets + gerçek captions ile
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const { EdgeTTS } = require("@andresaya/edge-tts");

const OUT = "/tmp/mira-assets";
fs.mkdirSync(OUT, { recursive: true });

// 1) 3 test görseli (1080x1920, farklı tonlar)
const colors = ["0x0b1e3a", "0x2a0b3a", "0x0b3a2a"];
for (let i = 0; i < 3; i++) {
  const p = path.join(OUT, `img${i + 1}.jpg`);
  execFileSync(ffmpegPath, ["-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `color=c=${colors[i]}:size=1080x1920:duration=1:rate=30`,
    "-frames:v", "1", "-q:v", "3", p]);
}
console.log("images ok");

(async () => {
  // 2) Gerçek Türkçe TTS + gerçek word boundary altyazıları
  const narration = "Bir günde 8 saat uyuyan bir insan, 80 yıllık ömrünün yaklaşık 27 yılını uykuda geçirir. Peki rüyalar neden var? Takipte kal, öğren.";
  const tts = new EdgeTTS();
  await tts.synthesize(narration, "tr-TR-EmelNeural", { rate: "-10%", outputFormat: "audio-24khz-96kbitrate-mono-mp3" });
  const audio = tts.toBuffer();
  const boundaries = tts.getWordBoundaries();

  // Kelime zamanlarından 4-5 kelimelik altyazı grupları kur
  const captions = [];
  for (let i = 0; i < boundaries.length; i += 4) {
    const group = boundaries.slice(i, i + 4);
    if (!group.length) break;
    captions.push({
      start: group[0].offset / 1e7,
      end: (group[group.length - 1].offset + group[group.length - 1].duration) / 1e7 + 0.1,
      text: group.map((w) => w.text).join(" "),
    });
  }
  const speechSeconds = (boundaries[boundaries.length - 1].offset + boundaries[boundaries.length - 1].duration) / 1e7;
  console.log("audio ok, speech seconds:", speechSeconds, "captions:", captions.length);

  // 3) Render isteği
  const body = {
    images: [1, 2, 3].map((n) => fs.readFileSync(path.join(OUT, `img${n}.jpg`)).toString("base64")),
    audioBase64: audio.toString("base64"),
    narrationText: narration,
    captions,
    durationSeconds: Math.ceil(speechSeconds + 0.5),
  };
  const res = await fetch("http://localhost:3100/api/video/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log("HTTP", res.status, "X-Mira-Render:", res.headers.get("x-mira-render"));
  if (!res.ok) {
    console.log("ERR BODY:", await res.text());
    process.exit(1);
  }
  const mp4 = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync("/tmp/mira-short-test2.mp4", mp4);
  console.log("saved bytes:", mp4.length);

  // 4) Mp4 doğrulama
  try {
    const info = execFileSync(ffmpegPath, ["-i", "/tmp/mira-short-test2.mp4", "-f", "null", "-"], { stdio: "pipe" }).toString();
    console.log("decode ok", info.slice(-200));
  } catch (e) {
    // ffmpeg -i çıkışı stderr'e yazar; video çözümlenebildiyse yine 'error' exit code döner (f null sonrasında 0)
    const err = e.stderr ? e.stderr.toString() : String(e);
    const match = err.match(/Duration: [^,]+|Stream #.+Video: .+|Stream #.+Audio: .+/g);
    console.log("probe:", match ? match.join("\n") : err.slice(-800));
  }
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
