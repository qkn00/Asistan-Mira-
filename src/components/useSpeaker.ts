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

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    stopLoop();
    setSpeaking(false);
    setWordIndex(-1);
  }, [stopLoop]);

  const speak = useCallback(
    (text: string, opts: { rate?: number; pitch?: number; onEnd?: () => void } = {}) => {
      stop();
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

      // Fallback timer drives words if boundary events are not fired by the voice
      let gotBoundary = false;
      let fallbackIdx = 0;
      const perWordMs = 330 / rate;
      setWord(0);
      timerRef.current = setInterval(() => {
        if (gotBoundary) return;
        fallbackIdx++;
        if (fallbackIdx >= words.length) {
          if (!hasTTS) finish();
          else targetRef.current = 0.2;
          return;
        }
        setWord(fallbackIdx);
      }, perWordMs);

      if (!hasTTS) return;

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "tr-TR";
      if (voiceRef.current) u.voice = voiceRef.current;
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
      window.speechSynthesis.speak(u);
    },
    [loop, stop, stopLoop],
  );

  useEffect(() => stop, [stop]);

  return { speak, stop, speaking, wordIndex, ampRef };
}
