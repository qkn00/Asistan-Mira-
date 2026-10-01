const timeoutMs = 8000;

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function baseUrl() {
  return (process.env.MIRA_N8N_BASE_URL || "").trim().replace(/\/$/, "");
}

export async function sendN8nConnectionTest() {
  const base = baseUrl();
  if (!base) {
    return {
      ok: false,
      verified: false,
      status: 503,
      message: "MIRA_N8N_BASE_URL yapılandırılmamış.",
    };
  }

  const payload = {
    action: "n8n_connection_test",
    source: "Mira",
    message: "Hello from Mira",
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetchWithTimeout(base + "/webhook-test/mira-test", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // Keep non-JSON webhook responses as text.
    }

    return {
      ok: response.ok,
      verified: response.ok,
      status: response.status,
      payload,
      response: data,
      message: response.ok
        ? "Mira → n8n test webhook çağrısı doğrulandı."
        : "n8n test webhook çağrısı başarısız oldu.",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      verified: false,
      status: 503,
      payload,
      message: "Mira → n8n bağlantı testi başarısız: " + reason.slice(0, 300),
    };
  }
}
