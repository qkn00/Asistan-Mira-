// İşçi (worker) tarafından üretilen taslak metnini bölümlerine ayırır.
// Beklenen başlıklar: KANCA, SESLENDİRME, EKRAN METNİ, GÖRSEL TASARIMI,
// SES VE MÜZİK, KAYNAK, AÇIKLAMA, ETİKETLER

const HEADINGS = [
  "KANCA",
  "SESLENDİRME",
  "EKRAN METNİ",
  "GÖRSEL TASARIMI",
  "SES VE MÜZİK",
  "KAYNAK",
  "AÇIKLAMA",
  "ETİKETLER",
] as const;

export type DraftSections = Partial<Record<(typeof HEADINGS)[number], string>>;

export function parseDraftScript(script: string): DraftSections {
  const sections: DraftSections = {};
  // Başlıkları satır başında ara: "SESLENDİRME:", "## SESLENDİRME", "**SESLENDİRME**" vb.
  const headingPattern = new RegExp(
    `^\\s*(?:#{1,4}\\s*|\\*\\*)?\\s*(${HEADINGS.join("|")})\\s*(?:\\*\\*)?\\s*:?\\s*$`,
    "gmi",
  );
  const matches = [...script.matchAll(headingPattern)];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].toUpperCase() as (typeof HEADINGS)[number];
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? script.length) : script.length;
    const value = script.slice(start, end).trim();
    if (value && !sections[name]) sections[name] = value;
  }
  return sections;
}

// Seslendirme metnini temizle: süre işaretleri, köşeli açıklamalar vb. çıkar
export function extractNarration(script: string, fallback = ""): string {
  const sections = parseDraftScript(script);
  const raw = sections["SESLENDİRME"] || fallback;
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+\s*(?:sn|saniye)|\(\d+[-–]\d+\s*sn\)|\[[^\]]*\]|\([0-9\s\-–]*saniye[0-9\s\-–]*\))\s*[:.)-]*\s*/i, ""))
    .map((line) => line.replace(/^\s*[-*•]\s+/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
