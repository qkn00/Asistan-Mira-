// Canlı Edge TTS testi: Türkçe ses + kelime zaman damgaları
const { EdgeTTS } = require("@andresaya/edge-tts");
const fs = require("fs");

(async () => {
  const text = "Bir günde 8 saat uyuyan bir insan, 80 yıllık ömrünün yaklaşık 27 yılını uykuda geçirir. Peki rüyalar neden var? Takipte kal, öğren.";
  const tts = new EdgeTTS();
  const started = Date.now();
  await tts.synthesize(text, "tr-TR-EmelNeural", {
    rate: "-10%",
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
  });
  const buf = tts.toBuffer();
  fs.writeFileSync("/tmp/mira-tts-test.mp3", buf);
  const boundaries = tts.getWordBoundaries();
  const audioInfo = tts.getAudioInfo();
  const last = boundaries[boundaries.length - 1];
  console.log(JSON.stringify({
    elapsedMs: Date.now() - started,
    mp3Bytes: buf.length,
    audioInfo,
    wordCount: boundaries.length,
    firstWord: boundaries[0],
    lastWord: last,
    lastWordEndSeconds: last ? (last.offset + last.duration) / 10_000_000 : null,
    sampleOffsetsRaw: boundaries.slice(0, 3),
  }, null, 2));
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
