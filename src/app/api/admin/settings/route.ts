import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { password, ...settings } = body;

    // Verify admin password
    const client = getSupabaseClient();
    const { data: current, error: fetchError } = await client.from('admin_settings').select('admin_password').eq('id', 1).maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (password !== current?.admin_password) {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 403 });
    }

    // Remove password from update data, unless changing it
    const updateData = { ...settings, updated_at: new Date().toISOString() };

    const { error } = await client.from('admin_settings').update(updateData).eq('id', 1);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
