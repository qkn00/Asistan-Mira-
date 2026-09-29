import { db } from "@/db";
import { operations } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await db.select().from(operations).orderBy(desc(operations.id)).limit(100)); }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.action !== "string" || typeof b.summary !== "string") return NextResponse.json({ error: "action ve summary gerekli" }, { status: 400 });
  const [row] = await db.insert(operations).values({ action: b.action.slice(0,100), summary: b.summary.slice(0,1000), status: typeof b.status === "string" ? b.status : "success", platform: typeof b.platform === "string" ? b.platform : null, externalId: typeof b.externalId === "string" ? b.externalId : null, metadata: b.metadata ?? null }).returning();
  return NextResponse.json(row, { status: 201 });
}
