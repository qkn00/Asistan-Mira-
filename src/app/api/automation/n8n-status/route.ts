import { NextResponse } from "next/server";
import { getN8nStatus } from "@/lib/n8n-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getN8nStatus();
  return NextResponse.json({ ok: true, ...status });
}
