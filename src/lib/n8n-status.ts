export type N8nStatus = {
  configured: boolean;
  reachable: boolean;
  workflowVerified: boolean;
  workflowActive: boolean | null;
  checkedAt: string;
  message: string;
};

const timeoutMs = 2500;

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

export async function getN8nStatus(): Promise<N8nStatus> {
  const checkedAt = new Date().toISOString();
  const base = baseUrl();
  const apiKey = (process.env.N8N_API_KEY || "").trim();
  const workflowId = (process.env.MIRA_N8N_WORKFLOW_ID || "").trim();

  if (!base) {
    return {
      configured: false,
      reachable: false,
      workflowVerified: false,
      workflowActive: null,
      checkedAt,
      message: "MIRA_N8N_BASE_URL yapılandırılmadı; n8n canlı bağlantısı doğrulanamıyor.",
    };
  }

  let reachable = false;
  try {
    const health = await fetchWithTimeout(base + "/healthz");
    reachable = health.ok;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    return {
      configured: true,
      reachable: false,
      workflowVerified: false,
      workflowActive: null,
      checkedAt,
      message: "n8n sunucusuna /healthz üzerinden ulaşılamadı.",
    };
  }

  if (!apiKey || !workflowId) {
    return {
      configured: true,
      reachable: true,
      workflowVerified: false,
      workflowActive: null,
      checkedAt,
      message: "n8n sunucusu erişilebilir; ancak workflow durumu doğrulanmadı. N8N_API_KEY ve MIRA_N8N_WORKFLOW_ID gerekli.",
    };
  }

  try {
    const response = await fetchWithTimeout(base + "/api/v1/workflows/" + encodeURIComponent(workflowId), {
      headers: { "X-N8N-API-KEY": apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        configured: true,
        reachable: true,
        workflowVerified: false,
        workflowActive: null,
        checkedAt,
        message: "n8n erişilebilir; workflow durumu API üzerinden doğrulanamadı.",
      };
    }

    const workflow = (await response.json()) as { active?: boolean };
    const active = workflow.active === true;

    return {
      configured: true,
      reachable: true,
      workflowVerified: true,
      workflowActive: active,
      checkedAt,
      message: active
        ? "n8n erişilebilir ve seçilen workflow aktif."
        : "n8n erişilebilir ancak seçilen workflow aktif değil.",
    };
  } catch {
    return {
      configured: true,
      reachable: true,
      workflowVerified: false,
      workflowActive: null,
      checkedAt,
      message: "n8n erişilebilir; workflow API kontrolü zaman aşımına uğradı veya başarısız oldu.",
    };
  }
}
