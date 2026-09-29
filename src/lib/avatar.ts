export type Emotion = "happy" | "surprised" | "sad" | "playful" | "focused";

export const OUTFITS = [
  { id: "sweater", label: "Krem Kazak", emoji: "🧶", src: "/avatar/outfit-sweater.jpg" },
  { id: "hoodie", label: "Lila Hoodie", emoji: "💜", src: "/avatar/outfit-hoodie.jpg" },
  { id: "blazer", label: "İş Şıklığı", emoji: "💼", src: "/avatar/outfit-blazer.jpg" },
  { id: "evening", label: "Gece Elbisesi", emoji: "🍷", src: "/avatar/outfit-evening.jpg" },
  { id: "sport", label: "Spor", emoji: "🏃‍♀️", src: "/avatar/outfit-sport.jpg" },
  { id: "denim", label: "Kot Ceket", emoji: "👖", src: "/avatar/outfit-denim.jpg" },
] as const;

export type OutfitId = (typeof OUTFITS)[number]["id"];

export const EMOTIONS: Record<Emotion, { label: string; emoji: string; src: string | null; tint: string }> = {
  happy: { label: "Mutlu", emoji: "😊", src: null, tint: "from-fuchsia-500/0" },
  surprised: { label: "Şaşırıyor", emoji: "❗", src: "/avatar/emotion-surprised.jpg", tint: "from-amber-400/20" },
  sad: { label: "Hüzünlü", emoji: "💧", src: "/avatar/emotion-sad.jpg", tint: "from-sky-500/25" },
  playful: { label: "Yaramaz/Şakacı", emoji: "🤭", src: "/avatar/emotion-playful.jpg", tint: "from-pink-500/20" },
  focused: { label: "Ciddi/Odaklanmış", emoji: "🎯", src: "/avatar/emotion-focused.jpg", tint: "from-indigo-500/25" },
};

export function isEmotion(v: unknown): v is Emotion {
  return typeof v === "string" && v in EMOTIONS;
}

export function outfitSrc(id: string): string {
  const m = /^custom-(\d+)$/.exec(id);
  if (m) return `/api/outfits/${m[1]}`;
  return OUTFITS.find((o) => o.id === id)?.src ?? OUTFITS[0].src;
}

export const FLIRTY_EMOJIS = ["💋", "💗", "✨", "😘", "💜", "🔥"];
