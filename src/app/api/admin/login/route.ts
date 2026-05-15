import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: Request) {
  try {
    const { wallet, password } = await request.json();
    const client = getSupabaseClient();

    // Verify admin password
    const { data: settings, error: settingsError } = await client.from('admin_settings').select('admin_password').eq('id', 1).maybeSingle();
    if (settingsError) throw new Error(settingsError.message);

    if (password !== settings?.admin_password) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
