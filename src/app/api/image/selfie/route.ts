import { Client } from "@gradio/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ENTRY_COOKIE = "mira_entry";
const PRIVATE_MODE_COOKIE = "mira_private_mode";
const SPACE_ID = "black-forest-labs/FLUX.1-schnell";
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const cookies = (req.headers.get("cookie") ?? "").split(";").map((part) => part.trim());
    const authenticated = cookies.includes(`${ENTRY_COOKIE}=1`);
    const privateMode = cookies.includes(`${PRIVATE_MODE_COOKIE}=1`);

    if (!authenticated) {
      return NextResponse.json({ error: "Önce Mira'ya giriş yapmalısın." }, { status: 401 });
    }
    if (!privateMode) {
      return NextResponse.json({ error: "Selfie özelliği yalnızca Mira özel modunda kullanılabilir. Önce KIRMIZI2206 yaz." }, { status: 403 });
    }

    const rawToken = process.env.HF_TOKEN?.trim();
    if (!rawToken) {
      return NextResponse.json({ error: "HF_TOKEN eksik. Railway Variables bölümüne Hugging Face erişim anahtarını ekle." }, { status: 503 });
    }

    const token = rawToken as `hf_${string}`;
    const client = await Client.connect(SPACE_ID, { token });
    const result = await client.predict("/infer", {
      prompt: "Photorealistic casual smartphone selfie portrait of Mira, an original fictional adult woman character, shoulder-length dark brown hair, warm brown eyes, natural makeup, friendly confident expression, simple black casual top, soft natural window light, realistic skin texture, natural facial proportions, head and shoulders, front camera perspective, candid everyday selfie, no text, no watermark.",
      seed: 0,
      randomize_seed: true,
      width: 1024,
      height: 1024,
      num_inference_steps: 5,
    });

    const first = Array.isArray(result.data) ? result.data[0] : null;
    const file = first && typeof first === "object" ? first as { url?: unknown; path?: unknown; mime_type?: unknown } : null;
    const remoteUrl = typeof first === "string"
      ? first
      : typeof file?.url === "string"
        ? file.url
        : typeof file?.path === "string" && /^https?:\/\//i.test(file.path)
          ? file.path
          : "";

    if (!remoteUrl) {
      console.error("Mira selfie API returned an unexpected image payload:", result.data);
      return NextResponse.json({ error: "Görsel üretildi ancak API görsel bağlantısını döndürmedi." }, { status: 502 });
    }

    const parsedUrl = new URL(remoteUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "black-forest-labs-flux-1-schnell.hf.space") {
      return NextResponse.json({ error: "Güvenlik nedeniyle beklenmeyen görsel adresi reddedildi." }, { status: 502 });
    }

    const imageResponse = await fetch(parsedUrl.toString(), { cache: "no-store" });
    if (!imageResponse.ok) {
      return NextResponse.json({ error: `Üretilen görsel alınamadı (HTTP ${imageResponse.status}). Tekrar deneyebilirsin.` }, { status: 502 });
    }
    const contentType = imageResponse.headers.get("content-type") ?? "image/webp";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Görsel servisi beklenen görüntü dosyasını döndürmedi." }, { status: 502 });
    }
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Oluşturulan görsel boş veya izin verilen boyuttan büyük." }, { status: 502 });
    }

    const imageUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({
      reply: "📸 Selfie'm hazır! Bu, Mira'nın oluşturulmuş kurgusal karakter portresi.",
      imageUrl,
      seed: Array.isArray(result.data) && typeof result.data[1] === "number" ? result.data[1] : null,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Mira FLUX selfie generation failed:", reason);
    return NextResponse.json(
      { error: `Selfie üretilemedi: ${reason.slice(0, 300)}` },
      { status: 502 },
    );
  }
}
