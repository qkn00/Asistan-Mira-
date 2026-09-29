import { NextResponse } from "next/server";
import { db } from "@/db";
import { customOutfits, settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) return new NextResponse("Not found", { status: 404 });
  const [row] = await db.select().from(customOutfits).where(eq(customOutfits.id, n));
  if (!row) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(row.data, "base64"), {
    headers: { "Content-Type": row.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: "Geçersiz" }, { status: 400 });
  await db.delete(customOutfits).where(eq(customOutfits.id, n));
  await db.update(settings).set({ outfit: "sweater" }).where(eq(settings.outfit, `custom-${n}`));
  return NextResponse.json({ ok: true });
}
