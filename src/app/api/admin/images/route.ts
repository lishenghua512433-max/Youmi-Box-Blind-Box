import { NextResponse } from 'next/server';

export async function GET() {
  // 直接返回空数组，让前端不报错
  return NextResponse.json([]);
}
