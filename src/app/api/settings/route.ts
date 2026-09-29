import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { OUTFITS } from "@/lib/avatar";

export const dynamic = "force-dynamic";

const fallbackSettings = {
  id: 1,
  userName: "Gökhan",
  outfit: "sweater",
  voiceRate: 1,
  voicePitch: 1.15,
  persona: "flirty",
  glamour: true,
};

export async function GET() {
  try {
    return NextResponse.json((await getSettings()) ?? fallbackSettings);
  } catch (error) {
    console.error("Mira settings GET failed; using fallback:", error);
    return NextResponse.json(fallbackSettings);
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof settings.$inferInsert> = {};

  if (typeof body.userName === "string" && body.userName.trim()) patch.userName = body.userName.trim().slice(0, 40);
  if (
    typeof body.outfit === "string" &&
    (OUTFITS.some((o) => o.id === body.outfit) || /^custom-\d+$/.test(body.outfit))
  ) {
    patch.outfit = body.outfit;
  }
  if (body.persona === "sweet" || body.persona === "flirty") patch.persona = body.persona;
  if (typeof body.glamour === "boolean") patch.glamour = body.glamour;
  if (typeof body.voiceRate === "number") patch.voiceRate = Math.min(2, Math.max(0.5, body.voiceRate));
  if (typeof body.voicePitch === "number") patch.voicePitch = Math.min(2, Math.max(0.5, body.voicePitch));

  try {
    await getSettings();
    if (Object.keys(patch).length) {
      await db.update(settings).set(patch).where(eq(settings.id, 1));
    }
    return NextResponse.json((await getSettings()) ?? fallbackSettings);
  } catch (error) {
    console.error("Mira settings PATCH failed:", error);
    return NextResponse.json({ ...fallbackSettings, ...patch, persisted: false });
  }
}
