import { NextResponse } from "next/server";
import { sendN8nConnectionTest } from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await sendN8nConnectionTest();

  return NextResponse.json(result, {
    status: result.status,
  });
}
