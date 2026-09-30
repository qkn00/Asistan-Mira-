export type ModelProvider = "openai" | "gemini" | "claude";

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

async function readError(res: Response): Promise<string> {
  const body = await res.text();
  return body.slice(0, 800);
}

async function callOpenAI(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  // Use the current Responses API and a current low-cost GPT-5.6 model.
  // This avoids depending on the older Chat Completions path for Mira's
  // primary brain while keeping the provider interface unchanged.
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const input = [
    ...request.history.slice(-10).map((turn) => ({
      role: turn.role,
      content: [{ type: "input_text", text: turn.content }],
    })),
    {
      role: "user",
      content: [{ type: "input_text", text: request.message }],
    },
  ];

  const res = await fetch("https://api.openai.com/v1/responses", {
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

  const data = await res.json();
  const content = cleanText(data?.output_text);
  if (!content) throw new Error("OpenAI returned empty content");

  return { provider: "openai", model, content };
}

async function callGemini(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const contents = [
    ...request.history.slice(-10).map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: request.message }] },
  ];

  const res = await fetch(
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

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await readError(res)}`);

  const data = await res.json();
  const content = cleanText(
    data?.candidates?.[0]?.content?.parts
      ?.filter((part: { text?: unknown }) => typeof part?.text === "string")
      ?.map((part: { text: string }) => part.text)
      ?.join(""),
  );
  if (!content) throw new Error("Gemini returned empty content");

  return { provider: "gemini", model, content };
}

async function callClaude(request: ModelRequest): Promise<ModelResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const messages = [
    ...request.history.slice(-10),
    { role: "user", content: request.message },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
};

function providerOrder(): ModelProvider[] {
  const configured = (process.env.MODEL_PROVIDER_ORDER || "gemini,openai,claude")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ModelProvider => item === "openai" || item === "gemini" || item === "claude");

  return [...new Set(configured)];
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
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${provider}: ${reason}`);
      console.error("Mira model failed; trying next provider", {
        provider,
        reason: reason.slice(0, 500),
      });
    }
  }

  throw new Error(`All configured model providers failed. ${failures.join(" | ")}`);
}
