"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeakerOptions = {
  rate?: number;
  pitch?: number;
  solMode?: "sweet" | "flirty" | "serious" | "excited" | "close";
  emotion?: "happy" | "surprised" | "sad" | "playful" | "focused";
  onEnd?: () => void;
};

export function useSpeaker() {
  const [speaking, setSpeaking] = useState(false);
  const [wordIndex, setWordIndex] = useState(-1);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const ampRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    targetRef.current = 0;
    ampRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    try {
      audioSourceRef.current?.stop();
    } catch {
      // The source may already have ended.
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;

    try {
      analyserRef.current?.disconnect();
    } catch {
      // Ignore an already-disconnected analyser.
    }

    analyserRef.current = null;
    stopLoop();
    setSpeaking(false);
    setWordIndex(-1);
  }, [stopLoop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const speak = useCallback(
    async (text: string, opts: SpeakerOptions = {}) => {
      stop();
      setVoiceError(null);

      const cleanText = text.trim();
      if (!cleanText) return;

      const words = cleanText.split(/\s+/).filter(Boolean);
      setSpeaking(true);
      setWordIndex(words.length ? 0 : -1);

      try {
        if (typeof window === "undefined") {
          throw new Error("Tarayıcı ortamı yok");
        }

        const Ctx =
          window.AudioContext ??
          (window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }).webkitAudioContext;

        if (!Ctx) {
          throw new Error("AudioContext desteklenmiyor");
        }

        if (!audioContextRef.current) {
          audioContextRef.current = new Ctx();
        }

        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            solMode: opts.solMode ?? "close",
            emotion: opts.emotion ?? "happy",
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            `/api/tts ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
          );
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("audio/")) {
          throw new Error(`/api/tts ses yerine ${contentType || "bilinmeyen veri"} döndürdü`);
        }

        const audioData = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(audioData.slice(0));

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;

        const data = new Uint8Array(analyser.fftSize);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        analyserRef.current = analyser;
        audioSourceRef.current = source;

        const startedAt = performance.now();
        const duration = Math.max(0.1, buffer.duration);

        const finish = () => {
          if (audioSourceRef.current === source) {
            audioSourceRef.current = null;
          }
          stopLoop();
          setSpeaking(false);
          setWordIndex(-1);
          opts.onEnd?.();
        };

        source.onended = finish;
        source.start(0);

        const syncAudio = () => {
          if (audioSourceRef.current !== source) return;

          const elapsed = (performance.now() - startedAt) / 1000;
          const progress = Math.min(1, elapsed / duration);
          const index = Math.min(
            words.length - 1,
            Math.floor(progress * words.length),
          );
          setWordIndex(index);

          analyser.getByteTimeDomainData(data);

          let sum = 0;
          for (let i = 0; i < data.length; i += 1) {
            const value = (data[i] - 128) / 128;
            sum += value * value;
          }

          const rms = Math.sqrt(sum / data.length);
          const speechLevel = Math.min(
            1,
            Math.max(0, (rms - 0.008) / 0.075),
          );

          targetRef.current = 0.08 + speechLevel * 0.92;
          ampRef.current +=
            (targetRef.current - ampRef.current) * 0.35;

          rafRef.current = requestAnimationFrame(syncAudio);
        };

        rafRef.current = requestAnimationFrame(syncAudio);
      } catch (error) {
        console.error("Mira TTS /api/tts hatası:", error);
        setVoiceError("Ses çalınamadı");
        stopLoop();
        setSpeaking(false);
        setWordIndex(-1);
      }
    },
    [stop, stopLoop],
  );

  return {
    speak,
    stop,
    speaking,
    wordIndex,
    ampRef,
    voiceError,
  };
}
