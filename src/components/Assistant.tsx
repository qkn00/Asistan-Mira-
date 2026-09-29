"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMOTIONS, OUTFITS, FLIRTY_EMOJIS, outfitSrc, isEmotion, type Emotion } from "@/lib/avatar";
import { useSpeaker } from "./useSpeaker";

type Msg = { id: number; role: string; content: string; emotion: string; createdAt: string };
type Settings = { userName: string; outfit: string; voiceRate: number; voicePitch: number; persona: string; glamour: boolean };
type Custom = { id: number; label: string };
type Tab = "chat" | "wardrobe" | "emotions" | "settings";

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
  const { speak, stop, speaking, wordIndex, ampRef } = useSpeaker();

  const faceRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SR | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoListenRef = useRef(true);
  const speechSupportedRef = useRef(false);
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
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, thinking]);

  // Lip-sync animation: drive face micro-motion + waveform from amplitude
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = ampRef.current;
      const t = performance.now() / 1000;
      if (faceRef.current) {
        const nod = a * 2.2;
        const sway = Math.sin(t * 1.3) * (speaking ? 0.6 : 0.25);
        faceRef.current.style.transform = `translateY(${-nod}px) rotate(${sway * 0.4}deg) scale(${1.03 + a * 0.006})`;
      }
      if (barsRef.current) {
        const bars = barsRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const el = bars[i] as HTMLElement;
          const phase = Math.sin(t * 9 + i * 0.9) * 0.5 + 0.5;
          const h = speaking ? 0.18 + a * (0.4 + phase * 0.6) : listening ? 0.2 + phase * 0.35 : 0.12;
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
      const voiceProfile =
        settings.persona === "flirty"
          ? { rate: settings.voiceRate * 0.94, pitch: settings.voicePitch * 1.10 }
          : { rate: settings.voiceRate * 1.02, pitch: settings.voicePitch * 0.94 };

      speak(text, {
        rate: Math.min(2, Math.max(0.5, voiceProfile.rate)),
        pitch: Math.min(2, Math.max(0.5, voiceProfile.pitch)),
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

  const activeSrc = emotion !== "happy" && EMOTIONS[emotion].src ? EMOTIONS[emotion].src! : outfitSrc(settings.outfit);
  const layers = [
    ...OUTFITS.map((o) => o.src),
    ...customs.map((c) => `/api/outfits/${c.id}`),
    ...Object.values(EMOTIONS).map((e) => e.src).filter(Boolean),
  ] as string[];
  const glam = settings.glamour;
  const showHearts = glam && (emotion === "playful" || (settings.persona === "flirty" && speaking));
  const subtitleWords = subtitle.split(/\s+/).filter(Boolean);
  const status = listening ? "Dinliyorum..." : thinking ? "Düşünüyorum..." : speaking ? "Konuşuyorum..." : "Hazırım";

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
            {layers.map((src) => (
              <img
                key={src}
                src={src}
                alt="Dijital asistan"
                className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
                style={{ opacity: src === activeSrc ? 1 : 0 }}
              />
            ))}
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
            <img src={outfitSrc(settings.outfit)} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-fuchsia-400/60 md:h-10 md:w-10" />
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
                {subtitleWords.map((w, i) => (
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
                    {m.content}
                    {m.role === "assistant" && isEmotion(m.emotion) && (
                      <button onClick={() => say(m.content, m.emotion as Emotion)} className="ml-2 text-xs text-white/60 hover:text-white" title="Tekrar söylet">
                        {EMOTIONS[m.emotion].emoji} 🔊
                      </button>
                    )}
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
            <p className="text-xs text-white/50">
              İpucu: Sunucuda OPENAI_API_KEY tanımlarsan asistan yapay zekâ ile cevap verir; tanımlı değilse yerleşik Türkçe sohbet motoru çalışır.
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
