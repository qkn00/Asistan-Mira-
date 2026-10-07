export type ModelProvider = "openai" | "gemini" | "claude" | "openrouter" | "groq";

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

// API key parcalari hata mesajlarinda asla gorunmesin.
function redactSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_\-*]{6,}/g, "sk-***")
    .replace(/AIza[A-Za-z0-9_\-]{10,}/g, "AIza***");
}

async function readError(res: Response): Promise<string> {
  const body = await res.text();
  return redactSecrets(body.slice(0, 800));
}

// Son 10 mesaj; ilk mesaj her zaman "user" olmali (Claude/Gemini bunu ister).
function recentHistory(history: ModelTurn[]): ModelTurn[] {
  const recent = history.slice(-10).filter((turn) => cleanText(turn.content));
  while (recent.length > 0 && recent[0].role !== "user") recent.shift();
  return recent;
}

// Varsayilan 20 sn. Railway'de MODEL_TIMEOUT_MS ile degistirilebilir.
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

type OpenAIResponse = {
  output_text?: unknown;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: unknown }>;
  }>;
};

// Ham REST cevabinda output_text yoktur (SDK ekler); output[] icinden okunur.
function extractOpenAIText(data: OpenAIResponse): string {
  const direct = cleanText(data?.output_text);
  if (direct) return direct;

  const parts: string[] = [];
  for (const item of data?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const block of item?.content ?? []) {
      if (block?.type === "output_text" && typeof block?.text === "string") {
        parts.push(block.text);
      }
    }
  }
  return cleanText(parts.join(""));
}

async function callOpenAI(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const input = [
    ...recentHistory(request.history).map((turn) => ({
      role: turn.role,
      content: [
        {
          // Asistan mesajlari output_text, kullanici mesajlari input_text olmali.
          type: turn.role === "assistant" ? "output_text" : "input_text",
          text: turn.content,
        },
      ],
    })),
    {
      role: "user",
      content: [{ type: "input_text", text: request.message }],
    },
  ];

  const res = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      instructions: request.system,
      input,
      max_output_tokens: 1200,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await readError(res)}`);

  const data = (await res.json()) as OpenAIResponse;
  const content = extractOpenAIText(data);
  if (!content) throw new Error("OpenAI returned empty content");

  return { provider: "openai", model, content };
}

async function callGemini(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash";
  const models = [...new Set([primaryModel, fallbackModel])];

  const contents = [
    ...request.history.slice(-10).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: request.message }] },
  ];

  let lastError = "Gemini unavailable";

  for (const model of models) {
    // Keep chat responsive: retry transient Gemini capacity errors once, then
    // move immediately to the fallback model/provider instead of waiting 7s+.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: request.system }] },
            contents,
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const content = cleanText(
          data?.candidates?.[0]?.content?.parts
            ?.filter((part: { text?: unknown }) => typeof part?.text === "string")
            ?.map((part: { text: string }) => part.text)
            ?.join(""),
        );
        if (!content) throw new Error(`Gemini ${model} returned empty content`);

        return { provider: "gemini", model, content };
      }

      const body = await readError(res);
      lastError = `Gemini ${res.status}: ${body}`;

      // 503 UNAVAILABLE is transient. Use one short retry, then move on.
      if (res.status === 503 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }

      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

type OpenRouterMessage = {
  content?: unknown;
  reasoning_details?: unknown;
};

function extractOpenRouterText(data: {
  choices?: Array<{ message?: OpenRouterMessage }>;
}): string {
  const message = data?.choices?.[0]?.message;
  const direct = cleanText(message?.content);
  if (direct) return direct;

  // Some OpenRouter-compatible providers may return content blocks instead
  // of a single string. Read text blocks, but never expose reasoning_details.
  if (Array.isArray(message?.content)) {
    const parts = message.content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object" && "text" in block) {
          const text = (block as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter(Boolean);
    return cleanText(parts.join(""));
  }

  return "";
}

async function callOpenRouter(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing");

  const models = [...new Set(
    (process.env.OPENROUTER_MODEL ||
      "nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-lightning:free")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )];
  const messages = [
    { role: "system", content: request.system },
    ...request.history.slice(-10),
    { role: "user", content: request.message },
  ];

  let lastError = "OpenRouter returned empty content";

  // Try each configured OpenRouter model in the same service before
  // returning control to the next provider.
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1200,
          reasoning: { enabled: true, exclude: true },
        }),
      });

      if (!res.ok) {
        lastError = `OpenRouter ${model} ${res.status}: ${await readError(res)}`;
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        break;
      }

      const data = await res.json();
      const content = extractOpenRouterText(data);
      if (content) return { provider: "openrouter", model, content };

      lastError = `OpenRouter ${model} returned empty content`;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      break;
    }
  }

  throw new Error(lastError);
}

async function callGroq(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const messages = [
    { role: "system", content: request.system },
    ...recentHistory(request.history),
    { role: "user", content: request.message },
  ];

  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await readError(res)}`);

  const data = await res.json();
  const content = cleanText(data?.choices?.[0]?.message?.content);
  if (!content) throw new Error("Groq returned empty content");

  return { provider: "groq", model, content };
}

async function callClaude(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const messages = [
    ...request.history.slice(-10),
    { role: "user", content: request.message },
  ];

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: request.system,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}: ${await readError(res)}`);

  const data = await res.json();
  const content = cleanText(
    data?.content
      ?.filter((block: { type?: string; text?: unknown }) => block?.type === "text" && typeof block?.text === "string")
      ?.map((block: { text: string }) => block.text)
      ?.join(""),
  );
  if (!content) throw new Error("Claude returned empty content");

  return { provider: "claude", model, content };
}

const providers: Record<ModelProvider, (request: ModelRequest) => Promise<ModelResult>> = {
  openai: callOpenAI,
  gemini: callGemini,
  claude: callClaude,
  openrouter: callOpenRouter,
  groq: callGroq,
};

function providerOrder(): ModelProvider[] {
  const configured = (process.env.MODEL_PROVIDER_ORDER || "gemini,claude,openrouter,openai")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ModelProvider => item === "openai" || item === "gemini" || item === "claude" || item === "openrouter" || item === "groq");

  const unique = [...new Set(configured)];

  // An invalid/empty environment value must never disable all providers.
  // Fall back to the known-safe default order instead.
  return unique.length > 0 ? unique : ["gemini", "claude", "openrouter", "openai"];
}

export async function generateWithFallback(request: ModelRequest): Promise<ModelResult> {
  const order = providerOrder();
  const failures: string[] = [];

  for (const provider of order) {
    try {
      const result = await providers[provider](request);
      console.info("Mira model success", {
        provider: result.provider,
        model: result.model,
        fallback: failures.length > 0,
      });
      return result;
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? `timeout after ${PROVIDER_TIMEOUT_MS}ms`
          : error instanceof Error
            ? error.message
            : String(error);
      failures.push(`${provider}: ${reason}`);
      console.error("Mira model failed; trying next provider", {
        provider,
        reason: reason.slice(0, 500),
      });
    }
  }

  throw new Error(`All configured model providers failed. ${failures.join(" | ")}`);
}
