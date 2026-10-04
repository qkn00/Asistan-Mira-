import { db } from "@/db";
import { memories } from "@/db/schema";
import { desc, ilike } from "drizzle-orm";

// ============ TYPES ============

export type MemoryCommandType = 'save' | 'forget' | 'query' | 'none';

export type MemoryCommand = {
  type: MemoryCommandType;
  text: string;
  category: string;
  importance: number;
  hasSensitiveData: boolean;
  sensitivePatterns: string[];
};

// ============ SECRET PATTERNS ============
// These patterns represent CREDENTIALS and SECRETS that must never be stored
// even with user approval. This is a security boundary, not a suggestion.

const SECRET_PATTERNS = [
  // API Keys and credentials
  /\b(?:api[_-]?key|apikey|api_key)\s*[:=]\s*[^\s]+/i,
  
  // Bearer tokens and OAuth
  /\b(?:bearer|access[_-]?token|refresh[_-]?token|oauth[_-]?token|id[_-]?token)\s*[:=]?\s*[^\s]{10,}/i,
  
  // Passwords
  /\b(?:password|passwd|pwd)\s*[:=]\s*[^\s]+/i,
  
  // Private keys (PEM format)
  /(?:-----\s?BEGIN|-----\s?END).{0,50}(?:RSA|OPENSSH|PRIVATE|PGP|DSA|EC).{0,50}KEY/i,
  
  // Database connection strings
  /\b(?:postgres|mysql|mongodb|redis)(?:ql)?\s*:\/\/[^\s]*[:@]/i,
  
  // Git and version control tokens
  /\b(?:github|gitlab|bitbucket)[_-]?(?:pat|token|secret)[_-]?[^\s]*\b/i,
  /\b(?:ghp_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{30,}/,
  
  // AWS keys and secrets
  /\b(?:AKIA|ASIA|aws_access_key_id|aws_secret_access_key)[^\s]*\b/,
  /\b(?:aws_session_token|aws_secret_key)[^\s]*\b/i,
  
  // Google API keys
  /\b(?:AIza[0-9A-Za-z_-]{35})\b/,
  
  // Azure/Microsoft credentials
  /\b(?:azure[_-]?secret[_-]?key|azure[_-]?client[_-]?secret)[^\s]*\b/i,
  
  // Stripe, Twilio, and other service keys
  /\b(?:sk_live_|pk_live_|rk_live_)[A-Za-z0-9]{20,}/,
  /\b(?:AC[a-z0-9]{32})[^\s]*\b/, // Twilio
];

// ============ COMMAND PARSING ============

/**
 * Parse user message for memory-related commands.
 * Supports:
 *   "Bunu hatırla: [text]" → save
 *   "Bunu unut: [text]" → forget
 *   "Hatırlarım" or "Hatırlarım: [query]" → query
 */
export function parseMemoryCommand(message: string): MemoryCommand {
  const trimmed = message.trim();

  // Check for "Bunu hatırla:" (Turkish: "Remember this:")
  const saveMatch = trimmed.match(/^\s*bunu\s+hatırla\s*:\s*(.+)$/i);
  if (saveMatch) {
    const text = saveMatch[1].trim();
    return {
      type: 'save',
      text,
      category: inferCategory(text),
      importance: inferImportance(text),
      hasSensitiveData: hasSecretPatterns(text),
      sensitivePatterns: detectSecretPatterns(text),
    };
  }

  // Check for "Bunu unut:" (Turkish: "Forget this:")
  const forgetMatch = trimmed.match(/^\s*bunu\s+unut\s*:\s*(.+)$/i);
  if (forgetMatch) {
    const text = forgetMatch[1].trim();
    return {
      type: 'forget',
      text,
      category: 'unknown',
      importance: 0,
      hasSensitiveData: false,
      sensitivePatterns: [],
    };
  }

  // Check for "Hatırlarım" (Turkish: "I remember" / "What do I know?")
  if (trimmed.match(/^\s*hatırlarım\s*(?:[:?]|$)/i)) {
    return {
      type: 'query',
      text: '',
      category: 'unknown',
      importance: 0,
      hasSensitiveData: false,
      sensitivePatterns: [],
    };
  }

  // No memory command detected
  return {
    type: 'none',
    text: '',
    category: 'unknown',
    importance: 0,
    hasSensitiveData: false,
    sensitivePatterns: [],
  };
}

// ============ CATEGORY INFERENCE ============

function inferCategory(text: string): string {
  const lower = text.toLowerCase();

  // Personal info (name, identity)
  if (/(?:name|isim|adım|beni|ben|my)(?:\s+is)?/i.test(lower)) {
    return 'personal';
  }

  // Preferences and likes
  if (/(?:prefer|favorite|like|love|enjoy|seviy|beğen|hoş|zevk)/i.test(lower)) {
    return 'preference';
  }

  // Facts and knowledge
  if (/(?:fact|bilgi|fen|bilimsel|is|was|are|were|that|şey)/i.test(lower)) {
    return 'fact';
  }

  // Instructions and how-tos
  if (/(?:how to|nasıl|adım|step|prosedür|instruction|talimat)/i.test(lower)) {
    return 'instruction';
  }

  // Reminders and dates
  if (/(?:remind|hatırla|tarih|date|time|saat|when|ne zaman)/i.test(lower)) {
    return 'reminder';
  }

  return 'general';
}

// ============ IMPORTANCE INFERENCE ============

function inferImportance(text: string): number {
  const lower = text.toLowerCase();
  let score = 3; // default

  // Boost for strong emotional words
  if (/(?:love|adore|favorite|best|most|en|çok|severim|ideal)/i.test(lower)) {
    score += 1;
  }

  // Boost for personal/identity info
  if (/(?:name|birthday|anniversary|isim|doğum|kimliğim|ben)/i.test(lower)) {
    score += 1;
  }

  // Lower for weak preference statements
  if (/(?:sometimes|bazen|belki|maybe|might|could)/i.test(lower)) {
    score -= 1;
  }

  // Clamp to 1-5 range
  return Math.min(5, Math.max(1, score));
}

// ============ SECRET DETECTION ============

/**
 * Check if text contains any secret patterns.
 * Returns true if ANY pattern matches (immediate block, no approval possible).
 */
export function hasSecretPatterns(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Detect which secret patterns match in the text.
 * Returns human-readable pattern names for user message.
 */
export function detectSecretPatterns(text: string): string[] {
  const detected: string[] = [];

  if (/\b(?:api[_-]?key|apikey|api_key)\s*[:=]/i.test(text)) detected.push('API key');
  if (/\b(?:bearer|access[_-]?token|refresh[_-]?token|oauth[_-]?token)\s*[:=]?\s*[^\s]{10,}/i.test(text)) detected.push('token');
  if (/\b(?:password|passwd|pwd)\s*[:=]/i.test(text)) detected.push('password');
  if (/(?:-----\s?BEGIN|-----\s?END).*(?:KEY|PRIVATE)/i.test(text)) detected.push('private key');
  if (/\b(?:postgres|mysql|mongodb|redis)(?:ql)?\s*:\/\//i.test(text)) detected.push('database URL');
  if (/\b(?:github|gitlab)[_-]?(?:pat|token|secret)/i.test(text)) detected.push('auth token');
  if (/\b(?:AKIA|ASIA|aws_access_key_id|aws_secret_access_key)/i.test(text)) detected.push('AWS credentials');
  if (/\b(?:AIza[0-9A-Za-z_-]{35})\b/.test(text)) detected.push('Google API key');

  return detected.length > 0 ? detected : ['credentials/secrets'];
}

// ============ MEMORY RELEVANCE MATCHING ============

/**
 * Find memories relevant to the current user message.
 * Uses keyword matching and importance scoring.
 * MVP approach: simple word overlap + importance weighting.
 */
export async function getRelevantMemories(
  userMessage: string,
  limit: number = 5
): Promise<(typeof memories.$inferSelect)[]> {
  try {
    // Extract keywords from message (simple tokenization, min 3 chars)
    const keywords = userMessage
      .toLowerCase()
      .match(/\b[a-zçğıöşüa-z]{3,}\b/g) || [];

    // If no keywords, return top-importance memories
    if (keywords.length === 0) {
      return db
        .select()
        .from(memories)
        .orderBy(desc(memories.importance), desc(memories.updatedAt))
        .limit(limit);
    }

    // Query all memories and score them
    const allMemories = await db.select().from(memories);

    // Score each memory based on keyword overlap
    const scoredMemories = allMemories
      .map((m) => {
        const memText = `${m.key} ${m.value}`.toLowerCase();
        const keywordMatches = keywords.filter((kw) => memText.includes(kw)).length;
        const score = keywordMatches * 10 + m.importance;
        return { memory: m, score };
      })
      .filter((x) => x.score > 0) // Only include memories that matched something
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.memory);

    // If no matches by keyword, return top-importance memories as fallback
    if (scoredMemories.length === 0) {
      return allMemories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit);
    }

    return scoredMemories;
  } catch (err) {
    console.error('[Memory] getRelevantMemories error:', err);
    return [];
  }
}

// ============ MEMORY CONTEXT FORMATTING ============

/**
 * Format memories into a human-readable context string for injection into Groq prompt.
 * Keeps formatting concise and natural.
 */
export function formatMemoriesForContext(
  mems: (typeof memories.$inferSelect)[]
): string {
  if (mems.length === 0) {
    return '(Henüz kaydedilmiş hafıza yok.)';
  }

  // Group memories by category
  const grouped = mems.reduce(
    (acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    },
    {} as Record<string, (typeof mems)>
  );

  // Order categories logically
  const categoryOrder = ['personal', 'preference', 'fact', 'instruction', 'reminder', 'general'];
  const sections = categoryOrder
    .filter((cat) => grouped[cat])
    .map((category) => {
      const items = grouped[category]!;
      const list = items
        .sort((a, b) => b.importance - a.importance)
        .map((m) => `  • ${m.value}`)
        .join('\n');
      return `${category}:\n${list}`;
    })
    .join('\n\n');

  return `Kullanıcı Hafızası:\n\n${sections}`;
}

// ============ APPROVAL FLOW RESPONSES ============

/**
 * Generate user-facing message for save approval.
 * If secrets detected, returns block message (not an approval prompt).
 */
export function generateSaveApprovalMessage(cmd: MemoryCommand): string {
  if (cmd.hasSensitiveData) {
    const patternsList = cmd.sensitivePatterns.join(', ');
    return `🚫 Bu bilgiyi kaydedebilirim, ama yapamam!

Tespit edilen hassas veriler: ${patternsList}

Bu tür bilgiler asla hafızaya kaydedilmez çünkü:
• Hack edilebilir ve çalınabilir
• Yetkisiz erişim riski taşır
• Gizlilik ve güvenlik kurallarını ihlal eder

💡 Alternatif: Bu bilgiyi:
  • Ortam değişkeni olarak (Railway/Vercel)
  • Güvenli bir şifre yöneticisinde (Bitwarden, 1Password)
  • Masaüstü güvenli dosyada
saklayın.`;
  }

  return `ℹ️ Bunu hatırlamak istiyorum. Onaylıyor musunuz?

📝 Metin: "${cmd.text}"
🏷️ Kategori: ${cmd.category}
⭐ Önem: ${cmd.importance}/5

Lütfen onaylamak için yazın:
  "Evet, hatırla!" — Kaydet ve hatırla
  "Hayır, sakın!" — İptal et`;
}

/**
 * Generate user-facing message for forget approval.
 * Queries database for memory details first.
 */
export async function generateForgetApprovalMessage(memoryKey: string): Promise<string> {
  try {
    const mem = await db
      .select()
      .from(memories)
      .where(ilike(memories.key, `%${memoryKey}%`))
      .limit(1);

    if (mem.length === 0) {
      return `ℹ️ Bu hafızayı kayıtlarda bulamadım: "${memoryKey}"`;
    }

    const m = mem[0];
    const createdDate = new Intl.DateTimeFormat('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(m.createdAt));

    return `⚠️ Bu hafızayı silmek istiyorum. Emin misiniz?

📝 Metin: "${m.value}"
🏷️ Kategori: ${m.category}
📅 Kaydedildi: ${createdDate}

Silmek istediğinizden emin misiniz?
  "Evet, sil!" — Kalıcı olarak sil
  "Hayır, tut!" — Saklı tut`;
  } catch (err) {
    console.error('[Memory] generateForgetApprovalMessage error:', err);
    return 'Hafıza silinirken hata oluştu.';
  }
}

/**
 * Parse user confirmation response.
 * Returns 'approve' or 'reject' based on user message.
 */
export function parseConfirmationResponse(message: string): 'approve' | 'reject' {
  const lower = message.toLowerCase().trim();

  // Turkish and English affirmatives
  if (/\b(?:evet|yes|yep|oui|sí|yup|sure|tamam|onay|kabul|accept)\b/i.test(lower)) {
    return 'approve';
  }

  // Turkish and English negatives
  if (/\b(?:hayır|no|nope|non|ama?o|refuse|reddet|iptal|cancel)\b/i.test(lower)) {
    return 'reject';
  }

  // Default to reject if unclear
  return 'reject';
}
