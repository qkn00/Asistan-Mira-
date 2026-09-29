export async function GET() {
  return Response.json({ memory: {} });
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ stored: body });
}
