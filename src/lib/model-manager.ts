export type ModelProvider = "openai" | "gemini" | "claude" | "cerebras" | "ollama";

export type ModelTurn = { role: "user" | "assistant"; content: string };

export type ModelRequest = {
  system: string;
  history: ModelTurn[];
  message: string;
};

export type ModelResult = {
  provider: ModelProvider;
  model: string;
  content: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function redactSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_\-*]{6,}/g, "sk-***")
    .replace(/AIza[A-Za-z0-9_\-]{10,}/g, "AIza***");
}

async function readError(res: Response): Promise<string> {
  const body = await res.text();
  return redactSecrets(body.slice(0, 800));
}

function recentHistory(history: ModelTurn[]): ModelTurn[] {
  const recent = history.slice(-10).filter((turn) => cleanText(turn.content));
  while (recent.length > 0 && recent[0].role !== "user") recent.shift();
  return recent;
}

const configuredTimeout = Number(process.env.MODEL_TIMEOUT_MS);
const PROVIDER_TIMEOUT_MS =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 20000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOllama(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error("OLLAMA_API_KEY missing");

  const baseUrl = (process.env.OLLAMA_BASE_URL || "https://ollama.com").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "treyleo16/kimi-k3:latest";
  const messages = [
    { role: "system", content: request.system },
    ...recentHistory(request.history),
    { role: "user", content: request.message },
  ];

  const res = await fetchWithTimeout(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    throw new Error(`Ollama ${model} ${res.status}: ${await readError(res)}`);
  }

  const data = await res.json();
  const content = cleanText(data?.message?.content);
  if (!content) throw new Error("Ollama returned empty content");

  return { provider: "ollama", model, content };
}

async function callGemini(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const contents = [
    ...recentHistory(request.history).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: request.message }] },
  ];

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents,
        generationConfig: { temperature: 0.7 },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini ${model} ${res.status}: ${await readError(res)}`);
  }

  const data = await res.json();
  const content = cleanText(
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: unknown }) => cleanText(part.text))
      .filter(Boolean)
      .join("\n"),
  );
  if (!content) throw new Error("Gemini returned empty content");

  return { provider: "gemini", model, content };
}

const providers: Record<ModelProvider, (request: ModelRequest) => Promise<ModelResult>> = {
  openai: async () => { throw new Error("OpenAI provider is not configured"); },
  gemini: callGemini,
  claude: async () => { throw new Error("Claude provider is not configured"); },
  cerebras: async () => { throw new Error("Cerebras provider is not configured"); },
  ollama: callOllama,
};

export async function generateWithFallback(request: ModelRequest): Promise<ModelResult> {
  try {
    return await providers.ollama(request);
  } catch (primaryError) {
    try {
      return await providers.gemini(request);
    } catch (fallbackError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Primary model failed (Ollama): ${primaryMessage}. Fallback failed (Gemini): ${fallbackMessage}`);
    }
  }
}
