import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const type = searchParams.get('type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const client = getSupabaseClient();
    let query = client
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (wallet) {
      query = query.eq('wallet_address', wallet);
    }
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.warn('[transactions GET] Database query failed, returning empty:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: true, data: [] });
  }
}
