import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json() as { password: string };
    if (password === '123456') {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
