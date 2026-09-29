import { NextResponse } from "next/server";
import { getDailyReport } from "@/lib/report";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.MIRA_N8N_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-mira-key") === expected;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date");
  const d = date ? new Date(`${date}T12:00:00+03:00`) : new Date();
  if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  return NextResponse.json(await getDailyReport(d));
}
