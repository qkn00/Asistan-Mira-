import { NextResponse } from 'next/server';

const ENTRY_COOKIE = 'mira_entry';

export async function POST(req: Request) {
  const expected = process.env.MIRA_ENTRY_PASSWORD?.trim();

  if (!expected) {
    return NextResponse.json(
      { error: 'MIRA_ENTRY_PASSWORD Railway ortam değişkeninde tanımlanmamış.' },
      { status: 503 },
    );
  }

  try {
    const { password } = await req.json();

    if (typeof password !== 'string' || password !== expected) {
      return NextResponse.json({ error: 'Şifre yanlış.' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ENTRY_COOKIE, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Geçersiz giriş isteği.' }, { status: 400 });
  }
}
