import { NextResponse } from "next/server";
import { db } from "@/db";
import { customOutfits } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({ id: customOutfits.id, label: customOutfits.label })
    .from(customOutfits)
    .orderBy(desc(customOutfits.id));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return NextResponse.json({ error: "Sadece JPG, PNG veya WEBP" }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ error: "En fazla 6 MB" }, { status: 400 });
  const label = String(form?.get("label") || "Özel Kıyafet").slice(0, 40);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const [row] = await db
    .insert(customOutfits)
    .values({ label, mime: file.type, data })
    .returning({ id: customOutfits.id, label: customOutfits.label });
  return NextResponse.json(row);
}
