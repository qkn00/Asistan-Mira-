"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EMOTIONS, OUTFITS, FLIRTY_EMOJIS, outfitSrc, isEmotion, type Emotion } from "@/lib/avatar";
import { useSpeaker } from "./useSpeaker";

type Msg = { id: number; role: string; content: string; emotion: string; createdAt: string };
type SolMode = "sweet" | "flirty" | "serious" | "excited" | "close";
type Settings = { userName: string; outfit: string; voiceRate: number; voicePitch: number; persona: string; solMode: SolMode; glamour: boolean };
type Custom = { id: number; label: string };
type Tab = "chat" | "wardrobe" | "emotions" | "settings";

function highlightCode(code: string, language?: string): ReactNode[] {
  const keywordPattern = /\b(const|let|var|function|return|if|else|for|while|async|await|new|class|import|from|export|default|try|catch|throw|true|false|null|undefined|def|print|in|and|or|not|None|True|False|echo|fi|then|do|done)\b/g;
  const tokenPattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/.*|#.*|\b\d+(?:\.\d+)?\b/g;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  const addPlain = (text: string) => {
    if (!text) return;
    let last = 0;
    let keywordMatch: RegExpExecArray | null;
    keywordPattern.lastIndex = 0;
    while ((keywordMatch = keywordPattern.exec(text))) {
      if (keywordMatch.index > last) nodes.push(text.slice(last, keywordMatch.index));
      nodes.push(
        <span key={nodes.length} className="text-fuchsia-300">
          {keywordMatch[0]}
        </span>,
      );
      last = keywordMatch.index + keywordMatch[0].length;
    }
    if (last < text.length) nodes.push(text.slice(last));
  };

  tokenPattern.lastIndex = 0;
  while ((match = tokenPattern.exec(code))) {
    if (match.index > cursor) addPlain(code.slice(cursor, match.index));
    const token = match[0];
    const isComment = token.startsWith("//") || token.startsWith("#");
    const isString = token.startsWith('"') || token.startsWith("'");
    const cls = isComment
      ? "text-white/40 italic"
      : isString
        ? "text-emerald-300"
        : "text-amber-300";
    nodes.push(
      <span key={nodes.length} className={cls}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }

  if (cursor < code.length) addPlain(code.slice(cursor));
  return nodes;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const lines = code.split("\\n");

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/10 bg-black/55 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/55">
        <span className="font-medium uppercase tracking-wide">{language || "kod"}</span>
        <button type="button" onClick={copyCode} className="rounded-md px-2 py-1 text-white/70 transition hover:bg-white/10 hover:text-white">
          {copied ? "Kopyalandı ✓" : "Kopyala"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto p-3 text-[12px] leading-relaxed text-white/90">
        <code>
          {lines.map((line, index) => (
            <span key={index} className="block">
              <span className="mr-3 inline-block w-5 select-none text-right text-[10px] text-white/20">{index + 1}</span>
              {highlightCode(line, language)}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function renderMessageContent(content: string) {
  const parts = content.split(/(```[a-zA-Z0-9_-]*\n?[\s\S]*?```)/g);
  return parts.map((part, index) => {
    const match = part.match(/^```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```$/);
    if (match) return <CodeBlock key={index} language={match[1]} code={match[2].replace(/\n$/, "")} />;
    if (!part) return null;
    return <span key={index} className="whitespace-pre-wrap break-words">{part}</span>;
  });
}


// Minimal Web Speech Recognition typings
type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Sohbet", icon: "💬" },
  { id: "wardrobe", label: "Gardırop", icon: "👗" },
  { id: "emotions", label: "Duygular", icon: "🎭" },
  { id: "settings", label: "Ayarlar", icon: "⚙️" },
];

export default function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [settings, setSettings] = useState<Settings>({
    userName: "patron",
    outfit: "sweater",
    voiceRate: 1,
    voicePitch: 1.15,
    persona: "flirty",
    solMode: "close",
    glamour: true,
  });
  const [customs, setCustoms] = useState<Custom[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [emotion, setEmotion] = useState<Emotion>("happy");
  const [tab, setTab] = useState<Tab>("chat");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const [muted, setMuted] = useState(false);
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);
  const { speak, stop, speaking, wordIndex, ampRef } = useSpeaker();

  const faceRef = useRef<HTMLDivElement>(null);
  const mouthRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SR | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoListenRef = useRef(true);
  const speechSupportedRef = useRef(false);
  const welcomeSpokenRef = useRef(false);
  const startListeningRef = useRef<(() => boolean) | null>(null);

  // Load data
  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      const next = data?.userName === "Gökhan" ? { ...data, userName: "patron" } : data;
      setSettings(next);
      if (data?.userName === "Gökhan") {
        fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: "patron" }) }).catch(() => {});
      }
    }).catch(() => {});
    fetch("/api/chat").then((r) => r.json()).then((d) => Array.isArray(d) && setMsgs(d)).catch(() => {});
    fetch("/api/outfits").then((r) => r.json()).then((d) => Array.isArray(d) && setCustoms(d)).catch(() => {});
    fetch("/api/tts/status").then((r) => r.json()).then((d) => setVoiceReady(d?.configured === true)).catch(() => setVoiceReady(false));
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  // Lip-sync: smooth the real TTS amplitude so Mira's mouth moves naturally
  // instead of snapping on every audio-frame. The face motion remains subtle.
  useEffect(() => {
    let raf = 0;
    let smoothed = 0;
    const tick = () => {
      const raw = Math.max(0, Math.min(1, ampRef.current));
      const target = speaking ? Math.max(0, raw - 0.035) : 0;
      smoothed += (target - smoothed) * (speaking ? 0.22 : 0.12);
      const a = Math.max(0, Math.min(1, smoothed));
      const t = performance.now() / 1000;

      if (faceRef.current) {
        const nod = speaking ? a * 1.25 : 0;
        const sway = Math.sin(t * 1.3) * (speaking ? 0.35 : 0.12);
        faceRef.current.style.transform =
          `translateY(${-nod}px) rotate(${sway * 0.25}deg) scale(${1.015 + a * 0.004})`;
      }

      if (mouthRef.current) {
        // The mouth sits around the reference portrait's mouth position.
        // Audio amplitude controls both aperture and width.
        const scaleY = speaking ? 0.08 + a * 1.35 : 0.08;
        const scaleX = speaking ? 0.78 + a * 0.28 : 0.78;
        mouthRef.current.style.transform =
          `translate(-50%, -50%) scale(${scaleX}, ${scaleY})`;
        mouthRef.current.style.opacity = speaking
          ? String(0.18 + a * 0.62)
          : "0";
      }

      if (barsRef.current) {
        const bars = barsRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const el = bars[i] as HTMLElement;
          const phase = Math.sin(t * 9 + i * 0.9) * 0.5 + 0.5;
          const h = speaking
            ? 0.18 + a * (0.4 + phase * 0.6)
            : listening
              ? 0.2 + phase * 0.35
              : 0.12;
          el.style.transform = `scaleY(${h})`;
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ampRef, speaking, listening]);

  const showEmotion = useCallback((e: Emotion, holdMs = 0) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setEmotion(e);
    if (holdMs > 0) resetTimer.current = setTimeout(() => setEmotion("happy"), holdMs);
  }, []);

  const say = useCallback(
    (text: string, e: Emotion) => {
      showEmotion(e);
      setSubtitle(text);
      const done = () => {
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setEmotion("happy"), 2500);
        setTimeout(() => setSubtitle(""), 1500);
        // After Mira finishes speaking, return to listening mode so the
        // conversation can continue hands-free. Browsers may require a
        // user gesture for the first microphone start; toggleMic handles
        // that fallback.
        if (autoListenRef.current) setTimeout(() => startListeningRef.current?.(), 250);
      };
      if (muted) {
        setTimeout(done, Math.max(2000, text.length * 60));
        return;
      }

      // Give each personality a genuinely different speaking profile.
      // The user's slider remains the base value; personality adds the
      // characteristic delivery on top of it.
      const solProfiles: Record<SolMode, { rate: number; pitch: number }> = {
        sweet: { rate: 0.98, pitch: 1.05 },
        flirty: { rate: 0.94, pitch: 1.10 },
        serious: { rate: 0.98, pitch: 0.92 },
        excited: { rate: 1.06, pitch: 1.08 },
        close: { rate: 0.96, pitch: 1.01 },
      };
      const voiceProfile = solProfiles[settings.solMode] ?? solProfiles.close;

      speak(text, {
        rate: Math.min(2, Math.max(0.5, voiceProfile.rate)),
        pitch: Math.min(2, Math.max(0.5, voiceProfile.pitch)),
        solMode: settings.solMode,
        emotion: e,
        onEnd: done,
      });
    },
    [muted, settings.voicePitch, settings.voiceRate, showEmotion, speak],
  );

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? input).trim();
      if (!text || thinking) return;
      setInput("");
      stop();
      const temp: Msg = { id: -Date.now(), role: "user", content: text, emotion: "happy", createdAt: new Date().toISOString() };
      setMsgs((m) => [...m, temp]);
      setThinking(true);
      showEmotion("focused");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMsgs((m) => [...m.filter((x) => x.id !== temp.id), data.user, data.assistant]);
        say(data.assistant.content, isEmotion(data.assistant.emotion) ? data.assistant.emotion : "happy");
      } catch {
        const errorText = "Bir bağlantı sorunu oldu, tekrar dener misin?";
        showEmotion("sad", 3000);
        setMsgs((m) => [
          ...m,
          { id: -Date.now() - 1, role: "assistant", content: errorText, emotion: "sad", createdAt: new Date().toISOString() },
        ]);
        say(errorText, "sad");
      } finally {
        setThinking(false);
      }
    },
    [input, thinking, stop, showEmotion, say],
  );

  const startListening = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    speechSupportedRef.current = !!Ctor;
    if (!Ctor || listening || thinking || speaking) return false;

    stop();
    const rec = new Ctor();
    rec.lang = "tr-TR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText = r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(finalText || interim);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) send(finalText);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
      return true;
    } catch {
      setListening(false);
      return false;
    }
  }, [listening, thinking, speaking, stop, send]);

  startListeningRef.current = startListening;

  const toggleMic = useCallback(() => {
    autoListenRef.current = true;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!startListening()) {
      say("Mikrofonu başlatamadım. iPhone'da bir kez mikrofon izni vermen gerekebilir.", "sad");
    }
  }, [listening, startListening, say]);

  useEffect(() => {
    // Best-effort hands-free start. Safari/iOS can block microphone access
    // until the page receives a user gesture, so failure is intentionally
    // silent and the microphone button remains available.
    const timer = window.setTimeout(() => startListening(), 900);
    return () => window.clearTimeout(timer);
  }, [startListening]);


  useEffect(() => () => recRef.current?.stop(), []);

  // Mira opens every session with the user's preferred address.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (welcomeSpokenRef.current) return;
      welcomeSpokenRef.current = true;
      say("Selam patron, nasılsın?", "happy");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [say]);

  const updateSettings = async (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  };

  const changeOutfit = (id: string) => {
    updateSettings({ outfit: id });
    const label = OUTFITS.find((x) => x.id === id)?.label ?? customs.find((c) => `custom-${c.id}` === id)?.label ?? "Yeni kıyafet";
    showEmotion("happy");
    const lines =
      settings.persona === "flirty"
        ? [`${label} giydim... Senin için. Yani, nasıl olmuşum?`, `Bu ${label} bana yakıştı mı sence? Dürüst ol ama...`, `${label} ile karşındayım. Beğendin mi, yoksa bir daha mı değişeyim?`]
        : [`${label} giydim! Yani... nasıl olmuşum?`];
    say(lines[Math.floor(Math.random() * lines.length)], "playful");
  };

  const uploadOutfit = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Özel Kıyafet");
      const res = await fetch("/api/outfits", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustoms((c) => [data, ...c]);
      changeOutfit(`custom-${data.id}`);
    } catch (e) {
      console.error("Mira outfit upload failed:", e);
      // Never expose Safari's English DOMException to the user.
      say("Avatar görselini yükleyemedim. Görseli tekrar seçip deneyelim.", "sad");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteOutfit = async (id: number) => {
    await fetch(`/api/outfits/${id}`, { method: "DELETE" });
    setCustoms((c) => c.filter((x) => x.id !== id));
    if (settings.outfit === `custom-${id}`) setSettings((s) => ({ ...s, outfit: "sweater" }));
  };

  const clearChat = async () => {
    await fetch("/api/chat", { method: "DELETE" });
    setMsgs([]);
  };

  const miraSrc = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAEAAQADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0mkpaSgBaSiigAoopKACkzQTTGbFADiaiaTFI8lULm7WMHNAFma4CDmqUt+AD/jWHeapuJx/OsW5vmc9SPxp2A17nUCxJz+tZ7akRnP8AOsuS42jrVfzS2T6CmNK5oXGpF8AA/TNR/aHkGEbBPQHv+NUGQKN0jBEx1LYJqWGeDzB5jMEx9/YR+VRKRrGHclZp/NaJlO4cEelIwjyBLnIPKDkj3NN1TVcjESqwH3HU8lff1PtWP9umc/vJnOPwP4VHM2i2oxdjprSMXG4BAyFGA2DoccHn8qzs+W3B68gVNpt27BUlciNiPnXqT1wf0pWW3mkKbxHxlvMbBH9OaUJWepcoqS0JYbxoRkHv61qWms4IBHP1rFlt/wDRiVK8kcDnkd+OgquoeJvmz6fj6Vsmmc8oNHoFpqgfr/OtqCcMOtebW90UYEmt+z1Tbjv+NFjM7QNmng1l2l4so9K0FbIpAS0UgpaACiiigApaSigAooooAKKKSgAzSE0E1G7YFAA0mKgklAqOSUCse/vgvGf1pgT3l+EU8/rXKXups5IHH41HqV3luD+tY8suT1qkhk8lyc/Wq7S56VEz5p0asw+Ufh60DSuBPzYJwMZJx0q2qiK23kqruQFZjwCT1/Ac0+GCMRGeT7vClgB1HfHeqWpXMVwwWNsImAoHTPqT1rGUr6I3jHlV2VrueIGTyQZGbILycjHqKoLKVOEcjP61J5MkZyjKQffrUq2kcoJYGJ/Q8A0JWIbbI1UyKQR154/nTTC3IYEleCf61MhjtQ28HcDxzwabLfZIaMbT0I9qYtOpJFuVduPlbqB/Onw3DCWQyjMZzuC8EnOaDeRkJhRk8n2NNULJGWXqxIxU2Kv2NOxixJBJHcorSRGQZ43EHlSPcc1q6jZYVZFUiN0DfL2PtXNQsxmiRCD5TfKPWusmm8i2jt5E3W6QkE/7QAJHtwazbcZG0bSiYG47ifTr7VctpvLIqLUEFvOikcjgjvjt+lVPN2sR6HFdS1RyyjZnX2V6c8GumtLwSDpj8a87s7gg5rptNuQ/fGKGiDrkfNSg1RgkyOtXFbNSBJRSA0tABRRRQAUlFFABmmk0uajdsUANd8VVmnAptzJxWLeXGCeaYEl9d+WpxzXJ6hcsW5Jq1e3mO9Yl1NvNUkMinmJPWoGO6o2bJpYzlueg61QyVUwqhuSwyBWjawvNMscY5B5OOg7n9DVKMNMyqv33PU+3Nad9KbOzAhyJHAVgvUKeufrnrWVR20N4LqZ2t3EZk8qFy204baOF+lYocnJKlj2yetWJE6l/mY8gLn+dMCjzRv6rzioSsiJNt3JLecopyq8cbRn/APVT5Jll+QxcYyTnFVmc4Vh95ecCkUM/C9RyBTFcseTG8YYsW5wExTfsigjfHlR1KnBpAHXDgcDgg+lXoJWiULtzwfm7nI6fhS1Q7JmcbVWUyASIoOCHHSplt5ljGxlwff8ArUyXoPlkxg4ADA9GI7mtlDa39kZFKQPGNu3qWHQEChtjjFMyYJRbMJAVLLxhe3/16sQ3kdxMq3BlMQbceBubt/SnX2ny2Kp5sfzlNzFV+6e2fwrPJZcbZNzg5XAxn0qLJ6l3a0Nq5tVvWe4in849cfxL7keg/pWbKjRPhwc+9bXh6QXR2SsY51PyEcFXxnA9jzxUesxIAtwiARyEgp/dYdcex6/jV05u/KxzgmuZGfHLjoa09PuSrVidOV6E1dsjtbJrdo5Wd7pl5uU5rchk3CuM02fZ26101nLxUMRrA04GolORUgNIB1FIDS0AJSZoppoARmxVeZ8CnyPiqNzKMHmgCrcy4zXL6lOVPB61szzAhua5rUG3NVIZnTtk9apuankqq/JrRIYzGTwalhXJwoJ459qYEJO3uav2kYJGWAi55I+8fWlJ2RcVcv2sMVvC8zMuVGMjoPXnuax9QvWubgnJCr1Ge1SajeiWVY1UpDGMBc1lDczkAZBORmua13dmkpW0QSS5YjdjsMdMUgBZgRnPriplgRSDLjP90cmrESljhIwo9epqjMgWDyyGk5B6YqRVO4NFCzVM7RQHLY3/AJmozPIwyQI17buSaLhYQyTgnMGFIwQMce9QNdyHCqpBHoO9Pc/7MgPrtxVqwiEjHzDkAE8jp70XHa5TjKFQvA9Sx/lTwzxFWVyB04NQui+eflI5/GrAjkZRk707e1DErm1aatFPZfZrkkOGG2WQj5ex47gCo208TQ/aPLMbLlcBep9V/nWI6AEYPHsa3NIvQ4Fk7JFHkFWflQwOd3v/APWqGrbGsZX0YeH98Nyi7MjDAlv6+lTXsnyurZaJpOp7DHX+VbTWyK84UAsEJAXjOeh/+tXPX3zKsa/LsUYDH7xpUleVzSWkbGe6lJGVuqnFTQyYYVBI25t2c560qnkV2WORnVWTBcc10lpIMAg1wlvOcgV0lhcEAVDRJ18T5FTg1l28m8DmtBGzUiJxS0wGnUgEJqN3pzHiqsjUARyvWRfyEDir0zkg1j3s5A6ZxTQFBpeDmsq4wSTUtxMWJxVN3wDk1aQyrLxmqjcHNTSvzULjOMVaQ0SWibpNx56qAe5Iq3eOILfyUfDZw+TjIx0osYQA0jDIjG7J4H0rO1CY+dIM5Yvn6cVhUd3Y2XuxK8xEshdm4PPU0qSYXCDb796hVTIctnb2HcmrUSZkxwX6k9kH+NSRuOt4Mnc4Kr6dzUk0pVdsfyjpgUTS+WPLTr+pNEMWPnk7UDt0QyOAKDJJwP1NPUyyZFtFgD+Irkn8a0bGwa7lDyghB0X2roobIQoBFCdo9RWUp2NoUrnGmxvGOWDA9TjOK0bGIwW8uTmQrhcnpXRtaF1IdRz6Ak00abEvJUj2qfaF+x7HBXETxzEShl9D6Vq6UpdgjgHcMA9n9vY1r6hpccoPGM1gAS6ZdhuTFnDA9MVfNzLQz5HB3Zd1CwESllGVI+bHp6+3pWNjyJADv4PT1rsr1ke1iu1G6PGWHqOjfoQfzrndQtFicg4HTBHTafusPb2pRlfcJxtqjd0+9F1cxPCApEQMm08DB/ljNV9dsvLlcjnHO4dQO34Vi21zLBIdp3FhtXZ0H+feuvvGE1kl1uDkKVkIHbGce9OL5ZXRSfNGzOLIxT1bFTXKASEgY9h0+oqEDJruWqOZqxdtmG6tq1k2ECsK2Xmta1OWFQyDqdPc45ragfisS0+7Wrbms2I0FNPqJakBpARN0qtKasseKoXDYNMCtO2AaxrpxzmtK6bK1g3s2KaGZ1wArGs6V8mrU75zzWYzEk1okMa5yaWBCzbuAAOCelNxk1pabaNLMrMPk/X8BTk7K5cVdjr0fZ9KKjrJ8x9cduKwwDM+7hV/iZq2dauImYAtlQuCe3+J+lYEk7PhUGF/hA/nXItdS5tXJWcs/lwjr3qZcQqET5nPUjuajiTy4wAMyN0rTtrMwxh2yZmGf90ev1obsEYtlVLYrzJy56+3rVu2gM7gDkZpZU5ESkbjgsc/dHpXQ6NY4USMuB/DnrUSlZGsIXZfsbRYYkUIOB1rQEYx0xRGuABUo4HNYnRsRMnpTTHnqM1YIoxjmiwXKUsAYHiuc1m0DwkFQDyDxXWSEYrJ1KMPAaE7MGrowdHnMmmSwvz5OSF9QB0/LNV5U8y3ki5drXO3B5aI9vyOfwpbBvs+ouh6OQMevamq/wBnuoCckFTG3/Af/rVp1MempktCiMHClge/r68V1WjoZ9ClRt2GYvuAwcZGBWJcWzxXjRqx+9kKDgg9Mj2IrrdOVILEhWGQnIJ75yacpbEwjZnIXilXKHrkkGqqnBNaerAeYW2/I/II9e9ZZ4r0IaxMJrUnikwa0baba4rJQ81ZiHzDmhozO4smJFa9uxHaue0qfAwR1xXRwtkCsWIuRtVhagj5qdelSIrucCqkoDA1aYcVSkGAaYGVdSda5vUJhnrWle3JDNgc1z04LMSatIZFNzzmqpp8mVqEHJrRDJI/kI9T+lbtgixwtIRyvUsccnsT+HSsi1iJZTnB6kn+EetbM0sVrpyxSKG3DKIBk49cHqfesK0rKx0U11Ob1CQyzsW27QTz/SoIkRfncEL15HJ+gqzdRumXUqWPXcdxUfyqC3iaaZV5Ys3fqayWxLTT1NXT7dVQ3lx93qPapbjzWUyyHyo252jr7VcREwARmCHjHqw6n8Kyby6Esh3n5Act9ahas1fuos2GlTX4PluI2+8CfStJLnVtImEdyBLFnjfyD9GrP07WktwCZI0GQMMe2K6GK/hu4VWTawkzgj5lIHf2pNtboqMYte69S3p2tWt4ArAxSd1b/GtdQjDKng1zTabCzAxExMPTpW3YK8duFkPOePYVN10Ls+paK+lMZTinbiDVK51SG3OHbvzS3HsSvmqF2MoR7VXfxJY7tpEo9wmaik1vT5RxKwzx8yEYqeRjU4mDc/u78N7cfhUF42JGPTZcHHsCKsXW2S+QIQykHDA5z1qrfD9/KB3OR9Qa0Ri+poXe6W0t7pACVGx+M8jGD+VadvcPJYGScDKoTiIYHP8AXFZunyKbcCQ4RiAecYyOv4EVryjytKbnPYZAB460o6uxfmc1eE7pFzyp6dQw9azzyelWZz9w5ywGCfWoD1NerFWRyS3FUVZiX3quDUsHzH6UmQdRozgg56jFdRbtlRXFafL5Z4NdRYXe8YxWMkSbsPNWRVS3PFWlNQIrtVOfkGrkhwKyru42CgDBvYssT71i3sYXkGte+uQM+9YF5MXrRDKMxzUcYywGMk8YoY5qa1QbgzjOc8e3c1eyLSNSzjCW+/AIB4J/jP8AQCpWiDRBmy88h5bBY468DpUBL3MkUQGQq5A7ZPbj/PFaMmLWFpshyi4Azxnv+uP0riq92dcDCuxEoKlWZl4LHuaj05BHICzbTjOfQVLNGFLNKcqPl57t1NRJtL5nDc/dRep9PoKlPQUviuXJ5xImxcrbrwMfxH0FMbR5LuAEjDk5Ydh7VcsLF7mVZJsKF+6o6KPT610sMCqoCqMe9RzW2NFT5ldnJ/2aqQxK1kg8skFgMhieme9PsNOMW9xL5MoXqqnZIc9MeldaIh0xj6UeQmc8nFVz3F7JJlGzO+0Lr91TggnlT6Vq2Lh1AY1UkyQQBgd8DrU1sCF6VmXYmuJhGpJOPSsqeCOcl2jHPUk1Yl/e3ChmwM9azL83JEnAgCgldw37vy4FEU2DsiQWViWG6OJh04k60s2maUyN+4CHHZjXNSfbxuCXLuRyN0YCnd2HrUX9oXNrdGC4UxuvG3PB981pyy6My9pDqizFbJaXwjRmaMvkZ7VFqilJlI6gj8e1S27G4vFI5BU4x9KfrKEtbHoSoOfelf3ga912JLJDLCGQ4BCuO/IPIrY1BWmsUAySi7gCO3rWboQ3Rbdo2H58N0IJ5q3eXDRXIYcITtGent+IpwTc9Cvs6nPT7ecHP4dKrZq5eovmeYn3X6g9Qe4qnXqrVHJLcUU5GKnim0qDJqWQXbe4KMOM11VhKEI75rkYV+YV01hGcDnNZSEzr7Vwy8VfWsjTvlBrVU5FZMkgY5Fc9q7bBkVuPwKwNXGVBzTQHK31wzN0rOletG6AYn2rKmOa1RQzqcetWIBliScKOCfYdqqAkH3qdJPL+6Mtjn29qplxNi2kkaSGKJdoYZKjrtHqfw6VavB5dssezeVXe3OAOep9vSo9Nh2R+bO3y7cH1I9Pz4+tJqbm4kFvnA+9Jj1x0/DiuCq9bI647FCC0nv384ttTccsOuParUFmkEr7QCSBgnknnvSw3i2cGJASki4wOo461PZXlvfzSG2DFUAyzDGaz1GuX5mraxhEAHFaEa9MVSh4OKvx+tQdCehJ5Z9KR1wpJ6etO39qhuWJRVJ+UnmgjUru4ztTkmp0Jjjz1NVYpbc3TRI5MoGSCCOKuzeWqAg4PoaGhoqqAz7vU094d34jvRbjMpVhgHkVZZMcdqSugaMW60sNIJELxyjkMvOKyLvQ3mkLzyNKOpLcGusIx3OKrzjcuKrnaJdNM521sxbToUDOiIT8xyff9KiuY/Pl8tgdq4x9cDH9fzrWvF+y6e7gjeWKqPXIqC0j+1W4mT75QKyn1FF+pLj9kZZRJCYgFdGUkE4wMdRUt4qXedpCzfxR9nweo9DS7zvyTk7en94Zx+fWs29LQynaRhRlTn8v6VvRi2yZtJFK6ykh7qx6/wCe9VDx0q9LKLlGZh+8/i/2vf61RI565r0Y7anJIKeiZNMPFTx80MgsLjI9q2NNvNhIxnNYaZzWppke5jWUhHY2E27tW0nSsKwwuK3IzkViySnLwK53VAQK6MkEVh62PlUimhnI3mdx5rLcc1q3q81nutaoZX24NWrNUVzNIu9U5I9T2FVmyTip4VLpgEcMCfQD1py2Ljubdo5mYSSnKJzjscDgfnmqu47TKxxuG5ifUnJqxbMrR/LwiRgJx2Lck+5xVS5T92pJwAeQe3WuJ/EdX2SpfyGSOJyCE6qvfJ9fpWh4XjAW5AH8Sk/rVZk86Fc4Xy+cn064/lU/h6cJevFyEdcDJzlgc/yzUPawo/EmdQicirWGVeKrqeAauDmIVizouR7wB1Gaa0i9CRXN6lc3Wn3rGV3ks2bqBzH9fUdauWEq3qr9muoWkckLHJlXP4frWqgLmV9WawgjZcqwL9vao5rR22OZJAwOQFbb+frUEkd7btiaAsBzleQPyp0d8Gbk8Dt6VLTRdr7MuwKxbdJgYGOKs5GKrRuGAKkYNP3AEjNTsSNk+nFQAbnwelOkkAHWq00jLbuRwzcL/U1JpcyNVmN3diKPJiQkAjoT3qXRVdA6kZ2kq3rTLyRIdi872UlEz09zRpDH5w3BaPeRnr61XQydrjtSj8lsp8ysQykDpzz+RrN1F/ORXAG4j5gP6VqzOLhGt88tkxsT1Pof8+lYEhxmMghemO4Nd1BHPNlVXZHDKeRQ+N5x060Ec80hHNdxzi09GqMVYjjyKhkslhHNbumRZfgVkQx5YV02k4XPHpWUhM2YbYnHatWJdoxUduMirQFYskyC9ZepSArVieUAdaxdQuQQQKaGYl83zYFUcDB5q1Ku4k1UkGDWqGQyADqeKWFsjaOACDSS9qlsojJICOoIxx0/+vTb0LjubNmn7qRpOg5IHQeg+tQFDNLhui9R/eqxOwiRbVAd3O7n+Lvk1HeHy4fKUgORkDOCcCuB3vfudfSxVvJlEoC52FyeP4//AK3aqLK9pJDPEMFJCevX/INTEu1wihAzhOM9Afan38eMRZJZRlvrntRtoQ9dTrLOdLi3SSM5VxkVeV/kArlPDk/l2xQnK72/CulicNWTVmbRd0VdSh3jfjIHUVnJp4ZPMiU7B+n0roWj3jHXNUmtJYWJi+76ZxVKRrFrZmfHd39oGMd5I4/uSgt/P/GqF1eapIQqwQSnBBdl2HnpyD2rck84gAx9PUD+dENozMDJ0Haq5xOEO5BotvqJTN1LGqdQqKSfzNbTqETk801SI1HoKhklycnpWTd2SNKhzzxXJX+pzXepyNaz7IEHlx9wQOpx78/pWjrOqAhrO2bMrDDsP4B6fU1gRW+10UIUGR846VcI9zOcuiL0pMzRM5JIG1j7dR/Wr2nk/aAP9lvyqijAyOByJMgfzFXNO/1pYc8E/hirnG0RRepFJJjCHODg49CDVS4ImTzP+Ww+/wC/of8AGn3BAAweTH1qmXxKTnrXbSj1MZMYOBSnkUh5ORT+1dDMRiircK8Gq6irCNxUMRZtRlq6fTFCnr6VzFuea27CfBGTWUhHZWx4q1msy0n3LV4PkVkScdMxIPNZky5NXZG21VmwOcgfWqGjPljxmqskfc1burlfLJgxM69VXI//AF1lvqUiRIzwxqXGRleQM+9PmKt3DaHYLx171oWDKhafPEQwnu3rWamozEEjbhsrlVAwKtG6keIRYjc4yRtB6+tRKd9DSFkWrXMsxkkxgAknrhR/UmiYtLPhBulyeD1x/nNQwXjKREtoWY/MQFPOOn4Zq3HId53JF5rEsy4Hyj/aI/lWU5K5tHVDLWIZ3vzHGOp6uew+lUHm3mSRgMuxc/TNWpr5bmRhFhI4RkFeOB2x9azgQ27AwNpA9+KzXmNvsaWigqJF6/OefXgVvW0nlSBT909K57Q33Fu3zf0FdAV3LUy3LhsbEZBUVLtHQGse2u2iOH5X1q4l7E3IYA+/FI0vcsMoBwwFRvhRUUl7EBncM1QnvHk4jB+pqWgLE1wAcE8CszVrqRNOneNirBDtI6irCRE/M5yaq6rF5lnLGP7ppJ6iexz2nwHajgkHOd2ep64Nak8JjfdHx5pA+bpyKz7Un5kKjBHOOhx3rZWVmtEbZu8oFTnncp/StL2lczitCg8RRc7CrHnb1/I1bgPlQO+Du2np+VIssFxEQsYVxznB/wAg+1JdABAvKgjPTj2rRS52kFralO7fK5DZwApFUCeTVibczMMjpzjpVbocV6NPRWOaTHrxSmhRmnlKpsgRalU4pm3FHI7VDETK+DwavW0hLDmswZqeJiD1qGI7jT58KB1rYSTiuN0u5IyDXQwT5FZNCMK44UnNcrdyXzP5ksYCegYEj8K0Lu+JUlGxzjrzWLJduw2qAv8AOgq1hhmBXI4PqvFLOkdzHvO7zVHr98f41UDeW+ex65qYEpyM9etArjYwJJFUZ2Dj6Yqffkje205Odp5NV2GG3rg7+D9aese7lyASMY6k1JSLcM00xEMBZA3Ltn5vfJ7Cie6WKEwQHdn7z/3vp7VA8wSExQ8KMBj3Y/4VAhOSq8Z+XPf8KjlL5uhfjHk2LucckDj+lQQvlQzdCQv+fzonkA08KP7xwBUcpMUUadCF3H86mxTZp6ISrOrdVbrXUQndGK5bTz++YgYDHNdHaPlQKymbU9iTbhz6Zp5jB5I4oYYYGpUII6VJoQGNe1Ojiy2cVNgdhT0Hr1qShNmFqhdgbXz/AHSK0n6VmXvPyikgZg24P20iMldhwSPc1rWheA4icAEZKk/L19un0rNgxHcz44XeB7jirm4lRwQpGMd2q2RHQttIJrgGRYyVPIQYB/HqaseRp7qVLTID94bsgfnVKCIiJyx+Zuvt7CszWrrybYICd8x5+neiKd9Bykkrsj1G505J2jtXkkQH5mZQM/T1p1jafbE3qqxRZ4ZyWJ+gHWsbT7Y3l2kfO3qfYV2cUQRAqjAAwAK6J1JRVkzCnHn1ZXj06yTG7zZD3wdo/LmrC29j/wA+a493Y/1qQR4p4TPasHVm+p0KEewqadpk4x5TxH1Rz/XNR3XhicRGWyYXKDnb0f8ALvU4jx061fsL17eRQxO2qhWknqyJ0k1ocY8ZQkMCCOCD2pgFd14g0yHU7U3dsoF0gyQP+Wg9PrXFlMV2xmpLQ4pRsWbOXawrcgm4rnI+GrUtWJFDIOPkmYtyTjNRyDByPTNLJyKaG3Rj24qRjGwwp0DZUoeo6U0cHFM3eXMp7Hg0CJ5SSpUFhx2qOKT5MD8qmK/yqsp2u3p0pDHjA4x2z+NKh4cg42rx9aQ5wCOvpQhO1lH8X+c0mNFjbvW2Qng5Y/SoS/nXLuen9KklbZbhR95uAfQZqFRsT/bYc+wqCzV0o9PUCugtm2vjsa5vSTiXB710OCEyOorKW5vDY0m5QGlRqZbtviFOIw3XFZGxMDkdakBwtQK1SjkcikMa7ZBqlKhL5q4wzUE6naAOrcfShAzISFTdS8lSybgR6g1bihVWJAJfGNxOaZdhYWgfHGSh+hH/ANaphIW+SIZ757ZpsSQTOqgKvJ44FclrchfUXUnPl4X+prtYbUKC7ck8EmuBvX82+nb1kb+da0lrcxruysbnhm2xFLORyx2g+w610IWqGhx7NKgH94FvzNagHFRN3kzSmrRQgTNSpH7ZpVXipkFZmlxoj4NRslW9vFRMKGO5LZ3DRnaTx71h6zaLFeO6cJL84Hoe/wDn3rT6MKZqqeZZJJ3Rv5/5Fa0ZWkY1o3jc5yNMtWrZpuB5xVILzWjZp1zXacBwp5FMi6OPfNO7YpkR+Zh7UgEYc5qKYcA1M3XvUcmCp7UATxPviHr3qFx+8/WltCA5BPynvT5F+bIGR2PY0hiYA6/kKeg64ztHLGkCqvLNnP8AdoZiyEYwvYCgELI25Q3Vh0x0xURJ2g+oNP7heuVz+tLt/coT1JNZs0WpeshsnT0kUH6V1Nuokg/CubtFzbxPzw2CfQGujs2K4HbHFYyOiCJbL5ZChPSrZHzc1XCbZQ4H1q7jJ9jWbNkRFcEcVKBlabJgU5T8vFDACoAyaqM+4lsZPQD2qaQNI2z8TT1hAFAGVc27ShQ5+TcB+fH9au2MY8lS4AYDkVLeBVt2HcY/mDUTsRKwHGTke3rQMdcSZyq9AMmvNmO5y3qc16HNlLSdz97YT+ledZ5Fb0epy13sd7pY26fbD/pmv8qvrVPTx/ocH/XNf5VdHWsJbm8diRetTJUS9qlSkUSVG4qWo260MaIGp0q+dYyp6rkfhzSPUluc5B6HiknZ3Bq6sYQG01ctiajkjwxXHQ4q1aJ1r0Ty2efzLs75qFOJPqKsyLnjNVtu2QUCFamsMrjinkU1ulAyFP4vQVeuI0AUIzsNquN3uKpwjIkq1Gd1tBnrtdPwByP50hohIxjH3fSl7D2pf4cUg+vNAAx2smO1TMAsa+oOagYZX+tWFy9vuPPyn8waiRcTT0weZBLCfcCt2wPm2qn+IDOPesHTTic++DW7Z/KXHQBj+vNc8tzrhsaMfzqD61OPuj2qsjbH/wBlvboanqWaoY/Jo3CNPfsPWnHgZpkeWbew4/hH9aQD0+QZONzcnFKXPY0hptAEN2SYSPXA/Wl2c57iiflVH+0P51IKBFbUm26Xcnt5Tc/hXnfevQNaO3SLof8ATM1wB+9XRS2OSvujvdK5sLc/9Mx/Kr2cDms/RDu0u2P+wKsPLm52A8AZNc8tzqjsW05qwtV4+lWFpDJBTHp1NfigCFqWDh6rXN/b2+RJKoPpnJqmNbtlfgk/hTUJPZCc4rdlyYD7VKvHDZ/Pmp4121gTzwXN690jsGYKNvToK27B/Otlbv0rsje2pw1Er3R//9k=";
  const activeSrc = miraSrc;
  const layers = [
    ...OUTFITS.map((o) => o.src),
    ...customs.map((c) => `/api/outfits/${c.id}`),
    ...Object.values(EMOTIONS).map((e) => e.src).filter(Boolean),
  ] as string[];
  const glam = settings.glamour;
  const showHearts = glam && (emotion === "playful" || (settings.persona === "flirty" && speaking));
  const subtitleWords = subtitle.split(/\s+/).filter(Boolean);
  const status = listening ? "Dinliyorum..." : thinking ? "Düşünüyorum..." : speaking ? "Konuşuyorum..." : "Hazırım";

  // Avatar subtitle should never expose raw Markdown/code fences.
  const subtitleDisplay = subtitle.replace(/\`\`\`[a-zA-Z0-9_-]*\n?/g, "").replace(/\`\`\`/g, "").trim();
  const displaySubtitleWords = subtitleDisplay.split(/\s+/).filter(Boolean);

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden md:flex-row">
      {/* Ambient blurred background */}
      <img src={activeSrc} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-3xl transition-all duration-700" />
      <div className="pointer-events-none absolute inset-0 bg-[#0b0718]/60" />

      {/* ===== Avatar stage (never covered) ===== */}
      <main className="relative z-10 flex min-h-0 flex-[1.15] flex-col p-2 md:flex-1 md:p-4">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-violet-400/20 shadow-2xl shadow-violet-900/40">
          <div
            ref={faceRef}
            className="absolute inset-0 will-change-transform transition-[filter] duration-700"
            style={{ transformOrigin: "50% 45%", filter: glam ? "saturate(1.15) contrast(1.06) brightness(1.04)" : "none" }}
          >
            <img
              src={miraSrc}
              alt="Mira dijital asistan"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div
              ref={mouthRef}
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[44%] z-20 h-[10px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[#5b263e]/90 shadow-[0_1px_4px_rgba(40,8,24,0.45)]"
              style={{ transformOrigin: "50% 50%", opacity: 0 }}
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${EMOTIONS[emotion].tint} to-transparent to-40% transition-all duration-700`} />
          </div>
          {glam && (
            <>
              <div className="glam-glow pointer-events-none absolute inset-0 mix-blend-screen" />
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(236,72,153,0.35)]" />
            </>
          )}
          {showHearts && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="float-heart absolute bottom-0 text-xl md:text-2xl"
                  style={{ left: `${6 + ((i * 37) % 88)}%`, animationDelay: `${(i * 0.45) % 4}s`, animationDuration: `${4 + (i % 3)}s` }}
                >
                  {FLIRTY_EMOJIS[i % FLIRTY_EMOJIS.length]}
                </span>
              ))}
            </div>
          )}
          {/* only a thin bottom fade for readability — face area stays clear */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

          {/* Top badges (small, in corners) */}
          <div className="glass absolute left-2 top-2 flex items-center gap-2 rounded-2xl px-2.5 py-1.5 md:left-3 md:top-3">
            <img src={miraSrc} alt="" className="h-8 w-8 rounded-full object-cover object-top ring-2 ring-fuchsia-400/60 md:h-10 md:w-10" />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                Dijital Asistanın <span className="h-2 w-2 rounded-full bg-green-400" />
              </div>
              <div className="text-[11px] text-white/70">Her zaman seninle 💗</div>
            </div>
          </div>
          <div className="glass absolute right-2 top-2 rounded-2xl px-3 py-1.5 text-xs md:right-3 md:top-3 md:text-sm">
            <div className="flex items-center gap-1.5 font-medium">
              <span className={`h-2 w-2 rounded-full ${speaking || listening ? "animate-pulse bg-fuchsia-400" : "bg-green-400"}`} /> {status}
            </div>
            <div className="text-[11px] text-white/70">
              {EMOTIONS[emotion].emoji} {EMOTIONS[emotion].label}
            </div>
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div className="pointer-events-none absolute inset-x-3 bottom-24 text-center md:bottom-28">
              <div className="fade-up inline-block max-w-2xl rounded-2xl bg-black/55 px-4 py-2 text-sm leading-relaxed backdrop-blur md:text-lg">
                {displaySubtitleWords.map((w, i) => (
                  <span key={i} className={`transition-colors ${i === wordIndex ? "text-fuchsia-300" : i < wordIndex ? "text-white" : "text-white/55"}`}>
                    {w}{" "}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Voice controls */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <div className="glass flex items-center gap-3 rounded-full px-4 py-2">
              <div ref={barsRef} className="flex h-8 items-center gap-[3px]">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="h-8 w-[3px] origin-center rounded-full bg-gradient-to-b from-fuchsia-400 to-violet-500" />
                ))}
              </div>
              <button
                onClick={toggleMic}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-violet-400 bg-violet-700/60 text-xl ${listening ? "pulse-ring" : ""}`}
                title="Sesli konuş"
              >
                🎙️
              </button>
              <button
                onClick={() => (speaking ? stop() : setTab("emotions"))}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                title={speaking ? "Durdur" : "Duygular"}
              >
                {speaking ? "⏹" : "🙂"}
              </button>
            </div>
          </div>
        </div>

        {/* Emotion strip (like reference) */}
        <div className="no-scrollbar mt-2 hidden gap-2 overflow-x-auto md:flex">
          {(Object.keys(EMOTIONS) as Emotion[]).map((e) => (
            <button
              key={e}
              onClick={() => showEmotion(e, 4000)}
              className={`relative h-24 min-w-0 flex-1 overflow-hidden rounded-2xl border-2 transition ${
                emotion === e ? "border-fuchsia-400 shadow-lg shadow-fuchsia-500/30" : "border-white/10 hover:border-white/40"
              }`}
            >
              <img src={EMOTIONS[e].src ?? outfitSrc(settings.outfit)} alt={EMOTIONS[e].label} className="h-full w-full object-cover object-center" />
              <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-black/65 px-2 py-0.5 text-[11px]">
                {EMOTIONS[e].emoji} {EMOTIONS[e].label}
              </span>
            </button>
          ))}
        </div>
      </main>

      {/* ===== Side panel ===== */}
      <aside className="glass relative z-10 m-2 mt-0 flex min-h-0 flex-1 flex-col rounded-3xl md:m-4 md:ml-0 md:w-[400px] md:flex-none">
        <div className="flex gap-1 border-b border-white/10 p-1.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs transition md:text-sm ${
                tab === n.id ? "bg-violet-600/70 text-white" : "text-white/70 hover:bg-white/10"
              }`}
            >
              <span>{n.icon}</span>
              <span className="hidden sm:inline">{n.label}</span>
            </button>
          ))}
        </div>

        {tab === "chat" && (
          <>
            <div className="flex items-center justify-between px-4 pt-2">
              <span className="text-xs text-white/50">Sohbet geçmişi</span>
              <button onClick={clearChat} className="text-xs text-white/50 hover:text-white">Temizle</button>
            </div>
            <div ref={chatRef} className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {msgs.length === 0 && (
                <div className="fade-up rounded-2xl rounded-tl-sm bg-violet-900/60 p-3 text-sm">
                  {settings.persona === "flirty"
                    ? <>Selam patron... Nasılsın? 💋 Seni bekliyordum. Yaz ya da mikrofona bas, konuşalım. Bu akşam ne giymemi istersin? Gardıroba bir bak 😉</>
                    : <>Selam patron! Nasılsın? 😊 Benimle yazarak ya da mikrofona basarak konuşabilirsin. Konuşurken sesim kelimelerine eşlik edecek, duygularım yüzüme yansıyacak.</>}
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={`fade-up flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.role === "user" ? "rounded-tr-sm bg-fuchsia-600/80" : "rounded-tl-sm bg-violet-900/70"}`}>
                    {renderMessageContent(m.content)}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex gap-1 px-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-violet-300" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              )}
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2">
              {["Merhaba! Nasılsın?", "YouTube video fikri ver", "TikTok trendleri neler?", "Bugün biraz üzgünüm", "Bana bir şaka yap"].map((q) => (
                <button key={q} onClick={() => send(q)} className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20">
                  {q}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "wardrobe" && (
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-xs text-white/60">Yüz, saç ve mimikler aynı — sadece kıyafet değişir.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadOutfit(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mb-3 w-full rounded-2xl border-2 border-dashed border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-3 text-sm hover:bg-fuchsia-500/20 disabled:opacity-50"
            >
              {uploading ? "Yükleniyor..." : "💋 Kendi kıyafet görselini yükle"}
              <span className="block text-[11px] text-white/50">Kendi ürettiğin görselleri buraya ekleyebilirsin</span>
            </button>
            {customs.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                {customs.map((c) => {
                  const id = `custom-${c.id}`;
                  return (
                    <div key={c.id} className={`group relative overflow-hidden rounded-2xl border-2 ${settings.outfit === id ? "border-fuchsia-400 shadow-lg shadow-fuchsia-500/30" : "border-transparent hover:border-white/30"}`}>
                      <button onClick={() => changeOutfit(id)} className="block w-full text-left">
                        <img src={`/api/outfits/${c.id}`} alt={c.label} className="aspect-square w-full object-cover object-center" />
                        <div className="truncate bg-black/60 px-2 py-1.5 text-xs">✨ {c.label}</div>
                      </button>
                      <button
                        onClick={() => deleteOutfit(c.id)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs opacity-0 transition group-hover:opacity-100"
                        title="Sil"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {OUTFITS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => changeOutfit(o.id)}
                  className={`group overflow-hidden rounded-2xl border-2 text-left transition ${
                    settings.outfit === o.id ? "border-fuchsia-400 shadow-lg shadow-fuchsia-500/30" : "border-transparent hover:border-white/30"
                  }`}
                >
                  <img src={o.src} alt={o.label} className="aspect-square w-full object-cover object-center transition group-hover:scale-105" />
                  <div className="bg-black/60 px-2 py-1.5 text-xs">{o.emoji} {o.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "emotions" && (
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-3 text-xs text-white/60">Cevabın duygusuna göre yüz otomatik değişir. Denemek için dokun.</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(EMOTIONS) as Emotion[]).map((e) => (
                <button
                  key={e}
                  onClick={() => showEmotion(e, 4000)}
                  className={`overflow-hidden rounded-2xl border-2 text-left ${emotion === e ? "border-fuchsia-400" : "border-transparent hover:border-white/30"}`}
                >
                  <img src={EMOTIONS[e].src ?? outfitSrc(settings.outfit)} alt={EMOTIONS[e].label} className="aspect-square w-full object-cover object-center" />
                  <div className="bg-black/60 px-2 py-1.5 text-xs">{EMOTIONS[e].emoji} {EMOTIONS[e].label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
            <label className="block">
              <span className="text-white/70">Sana nasıl hitap edeyim?</span>
              <input
                value={settings.userName}
                onChange={(e) => setSettings((s) => ({ ...s, userName: e.target.value }))}
                onBlur={(e) => updateSettings({ userName: e.target.value })}
                className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>
            <label className="block">
              <span className="text-white/70">Konuşma hızı: {settings.voiceRate.toFixed(2)}</span>
              <input type="range" min={0.5} max={2} step={0.05} value={settings.voiceRate}
                onChange={(e) => updateSettings({ voiceRate: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-500" />
            </label>
            <label className="block">
              <span className="text-white/70">Ses tonu: {settings.voicePitch.toFixed(2)}</span>
              <input type="range" min={0.5} max={2} step={0.05} value={settings.voicePitch}
                onChange={(e) => updateSettings({ voicePitch: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-500" />
            </label>
            <div>
              <span className="text-white/70">Sol modu</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {([
                  { id: "sweet", label: "🌸 Tatlı" },
                  { id: "flirty", label: "💋 Flörtöz" },
                  { id: "serious", label: "📋 Rapor" },
                  { id: "excited", label: "⚡ Heyecanlı" },
                  { id: "close", label: "🤍 Yakın" },
                ] as { id: SolMode; label: string }[]).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => updateSettings({ solMode: m.id })}
                    className={`rounded-xl py-2 ${settings.solMode === m.id ? "bg-fuchsia-600" : "bg-white/10 hover:bg-white/20"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-white/70">Kişilik</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {[
                  { id: "sweet", label: "😊 Tatlı" },
                  { id: "flirty", label: "💋 Flörtöz" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => updateSettings({ persona: p.id })}
                    className={`rounded-xl py-2 ${settings.persona === p.id ? "bg-fuchsia-600" : "bg-white/10 hover:bg-white/20"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.glamour} onChange={(e) => updateSettings({ glamour: e.target.checked })} className="accent-fuchsia-500" />
              ✨ Glamour görünüm (ışıltı + kalpler)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} className="accent-fuchsia-500" />
              Sessiz mod (sadece altyazı)
            </label>
            <button onClick={() => say("Selam patron! Sesimi test ediyoruz. Nasıl olmuşum?", "playful")}
              className="w-full rounded-xl bg-violet-600 py-2 font-medium hover:bg-violet-500">
              🔊 Sesi test et
            </button>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${voiceReady === true ? "bg-green-400" : voiceReady === false ? "bg-amber-400" : "bg-white/40"}`} />
                <span>{voiceReady === true ? "ElevenLabs sesi bağlı" : voiceReady === false ? "Tarayıcı sesi aktif — ElevenLabs bekleniyor" : "Ses durumu kontrol ediliyor..."}</span>
              </div>
              {voiceReady === false && (
                <p className="mt-1 text-white/50">Railway değişkenlerine ELEVENLABS_API_KEY ve ELEVENLABS_VOICE_ID eklendiğinde Mira otomatik olarak ElevenLabs sesine geçer.</p>
              )}
            </div>
            <p className="text-xs text-white/50">
              İpucu: OPENAI_API_KEY tanımlıysa Mira yapay zekâ ile cevap verir; tanımlı değilse yerleşik Türkçe sohbet motoru çalışır.
            </p>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="m-2 flex items-center gap-2 rounded-full border border-violet-400/30 bg-black/30 py-1.5 pl-4 pr-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Bir şey söyle..."
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-white/50"
          />
          <button disabled={thinking || !input.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 font-bold disabled:opacity-40">
            ›
          </button>
        </form>
      </aside>
    </div>
  );
}
