import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('nft_images').select('*').order('rarity');
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { rarity, image_url, password } = await request.json();
    const client = getSupabaseClient();

    // Verify admin password
    const { data: settings } = await client.from('admin_settings').select('admin_password').eq('id', 1).maybeSingle();
    if (password !== settings?.admin_password) {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 403 });
    }

    // Upsert image
    const { error } = await client.from('nft_images').upsert(
      { rarity, image_url },
      { onConflict: 'rarity' }
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
