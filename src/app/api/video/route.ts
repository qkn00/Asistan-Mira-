export const runtime = 'nodejs';

export async function POST() {
  return Response.json({ error: 'Video API kuruluyor.' }, { status: 503 });
}
