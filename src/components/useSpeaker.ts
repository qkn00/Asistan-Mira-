"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Text-to-speech + lip-sync driver.
 * Produces a 0..1 "mouth openness" value (ampRef) synchronized with the
 * spoken words using SpeechSynthesis boundary events, plus the index of the
 * word currently spoken for karaoke-style subtitles.
 */
export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false);
  const [wordIndex, setWordIndex] = useState(-1);
  const ampRef = useRef(0);
  const targetRef = useRef(0);
  const wordStartRef = useRef(0);
  const syllablesRef = useRef(2);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      const tr = voices.filter((v) => v.lang.toLowerCase().startsWith("tr"));
      voiceRef.current =
        tr.find((v) => /female|kadın|yelda|emel|seda|filiz/i.test(v.name)) ?? tr[0] ?? null;
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);

  const loop = useCallback(() => {
    const now = performance.now();
    const t = (now - wordStartRef.current) / 1000;
    // syllable oscillation inside the current word (~6 syllables/sec)
    const syl = Math.abs(Math.sin(t * Math.PI * 6));
    const env = targetRef.current * (0.35 + 0.65 * syl);
    ampRef.current += (env - ampRef.current) * 0.35;
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
    targetRef.current = 0;
    ampRef.current = 0;
  }, []);

  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new Ctx();
      if (audioContextRef.current.state === "suspended") void audioContextRef.current.resume();
      if ("speechSynthesis" in window) window.speechSynthesis.resume();
    } catch {
      // Browser may reject audio initialization until a later user gesture.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUserGesture = () => unlockAudio();
    window.addEventListener("pointerdown", onUserGesture, { passive: true });
    return () => window.removeEventListener("pointerdown", onUserGesture);
  }, [unlockAudio]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    try {
      audioSourceRef.current?.stop();
    } catch {
      // Source may already have ended.
    }
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    stopLoop();
    setSpeaking(false);
    setWordIndex(-1);
  }, [stopLoop]);

  const speak = useCallback(
    async (text: string, opts: { rate?: number; pitch?: number; solMode?: "sweet" | "flirty" | "serious" | "excited" | "close"; emotion?: "happy" | "surprised" | "sad" | "playful" | "focused"; onEnd?: () => void } = {}) => {
      stop();
      unlockAudio();
      const words = text.split(/\s+/).filter(Boolean);
      const wordStarts: number[] = [];
      let acc = 0;
      for (const w of text.split(/(\s+)/)) {
        if (w.trim()) wordStarts.push(acc);
        acc += w.length;
      }
      const setWord = (i: number) => {
        const w = words[i] ?? "";
        const vowels = (w.match(/[aeıioöuüAEIİOÖUÜ]/g) ?? []).length;
        syllablesRef.current = Math.max(1, vowels);
        targetRef.current = Math.min(1, 0.55 + vowels * 0.1);
        wordStartRef.current = performance.now();
        setWordIndex(i);
      };

      setSpeaking(true);
      rafRef.current = requestAnimationFrame(loop);

      const finish = () => {
        stopLoop();
        setSpeaking(false);
        setWordIndex(-1);
        opts.onEnd?.();
      };

      const rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));
      const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;

      // ElevenLabs is Mira's primary voice. If it is not configured or fails,
      // keep the assistant usable with the iPhone/browser Turkish voice.
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            solMode: opts.solMode ?? "close",
            emotion: opts.emotion ?? "happy",
          }),
        });

        if (response.ok && response.headers.get("content-type")?.includes("audio")) {
          const ctx = audioContextRef.current;
          if (!ctx) throw new Error("AudioContext hazır değil");
          if (ctx.state === "suspended") await ctx.resume();

          const audioData = await response.arrayBuffer();
          const buffer = await ctx.decodeAudioData(audioData.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          audioSourceRef.current = source;

          let startedAt = performance.now();
          const durationEstimate = Math.max(0.35, buffer.duration || text.length * 0.055 / rate);

          source.onended = () => {
            if (audioSourceRef.current === source) audioSourceRef.current = null;
            finish();
          };

          source.start(0);
          startedAt = performance.now();

          const syncAudio = () => {
            if (audioSourceRef.current === source) {
              const elapsed = (performance.now() - startedAt) / 1000;
              const progress = Math.min(1, elapsed / durationEstimate);
              const idx = Math.min(words.length - 1, Math.floor(progress * words.length));
              setWord(idx);
              targetRef.current = 0.48 + Math.abs(Math.sin(elapsed * 9)) * 0.42;
              wordStartRef.current = performance.now();
              rafRef.current = requestAnimationFrame(syncAudio);
            }
          };
          rafRef.current = requestAnimationFrame(syncAudio);
          return;
        }
      } catch {
        // Fall through to browser TTS.
      }

      if (!hasTTS) {
        finish();
        return;
      }

      let gotBoundary = false;
      let fallbackIdx = 0;
      const perWordMs = 330 / rate;
      setWord(0);
      timerRef.current = setInterval(() => {
        if (gotBoundary) return;
        fallbackIdx++;
        if (fallbackIdx >= words.length) {
          targetRef.current = 0.2;
          return;
        }
        setWord(fallbackIdx);
      }, perWordMs);

      let u: SpeechSynthesisUtterance;
      try {
        u = new SpeechSynthesisUtterance(text);
        u.lang = "tr-TR";
        const voices = window.speechSynthesis.getVoices();
        const tr = voices.filter((v) => v.lang.toLowerCase().startsWith("tr"));
        const voice = tr.find((v) => /female|kadın|yelda|emel|seda|filiz/i.test(v.name)) ?? tr[0];
        if (voice) u.voice = voice;
      } catch {
        u = new SpeechSynthesisUtterance(text);
        u.lang = "tr-TR";
      }
      u.rate = rate;
      u.pitch = opts.pitch ?? 1.15;
      u.onboundary = (e) => {
        if (e.name && e.name !== "word") return;
        gotBoundary = true;
        let idx = wordStarts.findIndex((s, i) => e.charIndex >= s && (wordStarts[i + 1] ?? Infinity) > e.charIndex);
        if (idx < 0) idx = 0;
        setWord(idx);
      };
      u.onend = finish;
      u.onerror = finish;
      try {
        window.speechSynthesis.speak(u);
      } catch {
        finish();
      }
    },
    [loop, stop, stopLoop, unlockAudio],
  );

  useEffect(() => stop, [stop]);

  return { speak, stop, speaking, wordIndex, ampRef };
}
