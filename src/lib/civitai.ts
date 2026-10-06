const CIVITAI_ORCHESTRATION_URL = "https://orchestration.civitai.com/v2/consumer/workflows";

export type CivitaiImageRequest = {
  prompt: string;
  aspectRatio?: "1:1" | "4:3" | "3:2" | "16:9" | "2.35:1" | "4:5" | "2:3" | "9:16";
  size?: "medium" | "large";
  creativity?: "raw" | "low" | "medium" | "high";
  quantity?: number;
};

export async function generateCivitaiImage(input: CivitaiImageRequest) {
  const token = process.env.CIVITAI_API_KEY?.trim();
  if (!token) throw new Error("CIVITAI_API_KEY missing");

  const response = await fetch(`${CIVITAI_ORCHESTRATION_URL}?wait=60`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      steps: [{
        $type: "imageGen",
        input: {
          engine: "fal",
          model: "krea2",
          operation: "createImage",
          size: input.size ?? "medium",
          prompt: input.prompt.slice(0, 5000),
          aspectRatio: input.aspectRatio ?? "9:16",
          creativity: input.creativity ?? "medium",
          quantity: Math.min(Math.max(input.quantity ?? 1, 1), 10),
        },
      }],
    }),
    cache: "no-store",
  });

  const raw = await response.text();
  let data: unknown = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch {}

  if (!response.ok) {
    throw new Error(`Civitai image generation ${response.status}: ${raw.slice(0, 500)}`);
  }

  return data;
}
