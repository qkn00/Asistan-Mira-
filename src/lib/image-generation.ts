import type { RenderImage } from "@/lib/render-video";
import { generateCivitaiImage } from "@/lib/civitai";

type ImageInput = {
  prompt: string;
  aspectRatio?: "1:1" | "9:16";
};

type ProviderResult = { provider: string; image: RenderImage };

function imageFromBase64(value: string, contentType = "image/jpeg"): RenderImage {
  const clean = value.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
  const bytes = Buffer.from(clean, "base64");
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) {
    throw new Error("Sağlayıcı boş veya 8 MB üzeri görsel döndürdü");
  }
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return { bytes, extension };
}

function findImageUrls(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    if (/^https?:\/\/\S+$/.test(value) && /\.(jpe?g|png|webp)(\?\S*)?$/i.test(value)) found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) findImageUrls(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) findImageUrls(item, found);
  }
  return [...new Set(found)];
}

async function generateLegacyCivitai(input: ImageInput): Promise<ProviderResult> {
  const result = await generateCivitaiImage({ prompt: input.prompt, aspectRatio: input.aspectRatio || "9:16", size: "medium" });
  const urls = findImageUrls(result);
  if (!urls.length) throw new Error("Civitai görsel URL'si döndürmedi");
  const response = await fetch(urls[0], {
    signal: AbortSignal.timeout(40_000),
    headers: { "User-Agent": "MiraContentPipeline/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Civitai görseli HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("Civitai görsel yerine farklı içerik döndürdü");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("Civitai görseli boş veya 8 MB üzeri");
  return {
    provider: "civitai-legacy",
    image: { bytes, extension: contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg" },
  };
}

async function generateCloudflare(input: ImageInput): Promise<ProviderResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) throw new Error("Cloudflare API ayarları eksik");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input.prompt.slice(0, 2048), steps: 4 }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    },
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}: ${raw.slice(0, 240)}`);
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error("Cloudflare geçerli JSON döndürmedi"); }
  const image = data && typeof data === "object" && "result" in data
    ? (data as { result?: { image?: unknown } }).result?.image : undefined;
  if (typeof image !== "string" || !image) throw new Error("Cloudflare görsel verisi döndürmedi");
  return { provider: "cloudflare-flux-1-schnell", image: imageFromBase64(image, "image/jpeg") };
}

async function generatePollinations(input: ImageInput): Promise<ProviderResult> {
  const token = process.env.POLLINATIONS_API_KEY?.trim();
  if (!token) throw new Error("Pollinations yedek API anahtarı ayarlı değil");

  const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(input.prompt.slice(0, 3000))}`);
  url.searchParams.set("model", process.env.POLLINATIONS_IMAGE_MODEL?.trim() || "flux");
  url.searchParams.set("width", input.aspectRatio === "1:1" ? "1024" : "768");
  url.searchParams.set("height", input.aspectRatio === "1:1" ? "1024" : "1365");
  url.searchParams.set("nologo", "true");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "image/*" },
    signal: AbortSignal.timeout(90_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`Pollinations HTTP ${response.status}: ${detail}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`Pollinations görsel yerine ${contentType || "bilinmeyen içerik"} döndürdü`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("Pollinations görseli boş veya 8 MB üzeri");
  return {
    provider: "pollinations",
    image: { bytes, extension: contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg" },
  };
}

/**
 * Ücretsiz kotası bulunan Cloudflare ana sağlayıcıdır.
 * Pollinations yalnızca API anahtarı tanımlanmışsa yedek olarak denenir.
 * Pollinations hesabı Pollen tüketebileceğinden API anahtarı harcama limitiyle sınırlandırılmalıdır.
 */
export async function generateImageWithFallback(input: ImageInput): Promise<ProviderResult> {
  const failures: string[] = [];
  const cloudflareConfigured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim());
  const pollinationsConfigured = Boolean(process.env.POLLINATIONS_API_KEY?.trim());

  // Keep the current production path intact until the new provider credentials are configured.
  // Once either new provider is configured, never fall back to Civitai automatically (Buzz may be chargeable).
  if (!cloudflareConfigured && !pollinationsConfigured && process.env.CIVITAI_API_KEY?.trim()) {
    try {
      const result = await generateLegacyCivitai(input);
      console.info("[Mira Image] provider success", JSON.stringify({ provider: result.provider, compatibilityMode: true }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Mira Image] legacy Civitai failed", JSON.stringify({ error: message.slice(0, 220) }));
      throw new Error(`Yeni API anahtarları ayarlı değil; mevcut Civitai yolu da başarısız: ${message.slice(0, 220)}`);
    }
  }

  const providers = [
    { name: "Cloudflare", configured: cloudflareConfigured, run: generateCloudflare },
    { name: "Pollinations", configured: pollinationsConfigured, run: generatePollinations },
  ];

  for (const provider of providers) {
    if (!provider.configured) {
      failures.push(`${provider.name}: yapılandırılmadı`);
      continue;
    }
    try {
      const result = await provider.run(input);
      console.info("[Mira Image] provider success", JSON.stringify({ provider: result.provider }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${provider.name}: ${message.slice(0, 220)}`);
      console.error("[Mira Image] provider failed", JSON.stringify({ provider: provider.name, error: message.slice(0, 220) }));
    }
  }

  throw new Error(`Tüm görsel API'leri başarısız: ${failures.join(" | ")}`);
}
