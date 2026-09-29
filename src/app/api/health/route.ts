import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: true });
  } catch (error) {
    console.error("Mira database health check failed:", error);
    return Response.json(
      { ok: false, database: false, error: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
