import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const client = getSupabaseClient();

    const { count: userCount } = await client.from('users').select('*', { count: 'exact', head: true });
    const { count: txCount } = await client.from('transactions').select('*', { count: 'exact', head: true });
    const { count: nftCount } = await client.from('nft_inventory').select('*', { count: 'exact', head: true });

    const { data: volumeData } = await client.from('transactions').select('amount').eq('type', 'buy_blindbox');
    const totalVolume = (volumeData || []).reduce((sum: number, t: { amount: string }) => sum + parseFloat(t.amount || '0'), 0);

    const { data: recentTx } = await client.from('transactions').select('*').order('created_at', { ascending: false }).limit(20);
    const { data: recentUsers } = await client.from('users').select('wallet_address, referral_code, created_at').order('created_at', { ascending: false }).limit(20);

    return NextResponse.json({
      success: true,
      data: {
        userCount: userCount || 0,
        txCount: txCount || 0,
        nftCount: nftCount || 0,
        totalVolume: totalVolume.toFixed(4),
        recentTransactions: recentTx || [],
        recentUsers: recentUsers || [],
      },
    });
  } catch (err) {
    console.warn('[admin/stats] Database query failed, returning defaults:', err instanceof Error ? err.message : err);
    return NextResponse.json({
      success: true,
      data: {
        userCount: 0,
        txCount: 0,
        nftCount: 0,
        totalVolume: '0.0000',
        recentTransactions: [],
        recentUsers: [],
      },
    });
  }
}
