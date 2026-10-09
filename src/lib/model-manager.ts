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

  const baseUrl = (process.env.OLLAMA_BASE_URL || "https://ollama.com").replace(/\\/$/, "");
  const model = process.env.OLLAMA_MODEL || "treyleo16/kimi-k3:latest";
  const messages = [
    { role: "system", content: request.system },
    ...request.history.slice(-10),
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

const providers: Record<ModelProvider, (request: ModelRequest) => Promise<ModelResult>> = {
  openai: async () => { throw new Error("Not used"); },
  gemini: async () => { throw new Error("Not used"); },
  claude: async () => { throw new Error("Not used"); },
  cerebras: async () => { throw new Error("Not used"); },
  ollama: callOllama,
};

export async function generateWithFallback(request: ModelRequest): Promise<ModelResult> {
  // Ollama Cloud tek sağlayıcıdır; başarısız olursa hatayı üst katmana ilet.
  return await callOllama(request);
}
