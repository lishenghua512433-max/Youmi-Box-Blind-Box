import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const RARITIES = ['fanpin', 'lingpin', 'xuanpin', 'xianpin', 'shenpin'] as const;

// Complete default settings — used when database is empty so the UI can always render
const DEFAULT_SETTINGS = {
  id: 0,
  price_usdt: 3,
  prob_fanpin: 71, prob_lingpin: 22, prob_xuanpin: 5.5, prob_xianpin: 1.2, prob_shenpin: 0.3,
  recycle_fanpin: 2.7, recycle_lingpin: 2.9, recycle_xuanpin: 3.3, recycle_xianpin: 4.6, recycle_shenpin: 12,
  trade_fee_rate: 5, recycle_fee_rate: 5, withdraw_fee_rate: 5,
  commission_l1: 4, commission_l2: 1,
  referral_enabled: true, min_withdraw: 5,
  collection_wallet: '', payout_wallet: '', payout_contract_address: '',
  usdt_contract: '0x55d398326f99059fF775485246999027B3197955',
  busd_contract: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  trx_contract: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dD',
  nft_contract_address: '',
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
      console.warn('[admin/settings] Database query error, using defaults:', error.message);
      return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
    }
    if (!data) {
      console.warn('[admin/settings] No data in table, using defaults');
      return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
    }
    // Remove admin password from public response
    const { admin_password, ...publicData } = data;
    return NextResponse.json({ success: true, data: publicData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/settings] GET failed, using defaults:', message);
    return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
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
