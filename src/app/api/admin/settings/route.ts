import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const RARITIES = ['fanpin', 'lingpin', 'xuanpin', 'xianpin', 'shenpin'] as const;

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
      console.error('[admin/settings] Supabase query error:', error.message);
      throw new Error(`Database error: ${error.message}`);
    }
    if (!data) {
      console.error('[admin/settings] No data returned — table may be empty or RLS is blocking access');
      throw new Error(
        'Settings not found. Possible causes: ' +
        '1) admin_settings table has no row with id=1; ' +
        '2) COZE_SUPABASE_SERVICE_ROLE_KEY is missing (RLS blocks anon access). ' +
        'Run the init SQL script to seed data.'
      );
    }
    // Remove admin password from public response
    const { admin_password, ...publicData } = data;
    return NextResponse.json({ success: true, data: publicData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/settings] GET failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const client = getSupabaseClient();

    const allowedFields = [
      'price_usdt', 'prob_fanpin', 'prob_lingpin', 'prob_xuanpin', 'prob_xianpin', 'prob_shenpin',
      'recycle_fanpin', 'recycle_lingpin', 'recycle_xuanpin', 'recycle_xianpin', 'recycle_shenpin',
      'trade_fee_rate', 'recycle_fee_rate', 'withdraw_fee_rate',
      'commission_l1', 'commission_l2', 'referral_enabled', 'min_withdraw',
      'collection_wallet', 'payout_wallet', 'payout_contract_address',
      'usdt_contract', 'busd_contract', 'trx_contract', 'nft_contract_address',
      'admin_password',
    ];

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    // Validate probabilities sum to ~100
    if (RARITIES.some(r => body[`prob_${r}`] !== undefined)) {
      const { data: current } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
      const settings = { ...current, ...updateData };
      const total = RARITIES.reduce((sum, r) => sum + parseFloat(String(settings[`prob_${r}`]) || '0'), 0);
      if (Math.abs(total - 100) > 0.1) {
        return NextResponse.json({ success: false, error: `Probabilities must sum to 100, current sum: ${total}` }, { status: 400 });
      }
    }

    const { error } = await client.from('admin_settings').update(updateData).eq('id', 1);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
