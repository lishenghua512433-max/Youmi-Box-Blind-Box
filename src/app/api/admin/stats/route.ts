import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const client = getSupabaseClient();

    // Get user count
    const { count: userCount } = await client.from('users').select('*', { count: 'exact', head: true });

    // Get transaction count
    const { count: txCount } = await client.from('transactions').select('*', { count: 'exact', head: true });

    // Get NFT count
    const { count: nftCount } = await client.from('nft_inventory').select('*', { count: 'exact', head: true });

    // Get recent transactions
    const { data: recentTx } = await client.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);

    // Get recent users
    const { data: recentUsers } = await client.from('users').select('wallet_address, referral_code, total_spent, total_boxes, created_at').order('created_at', { ascending: false }).limit(50);

    // Total volume
    const { data: volumeData } = await client.from('transactions').select('amount').eq('type', 'buy_blindbox');

    let totalVolume = 0;
    if (volumeData) {
      totalVolume = volumeData.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    }

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
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
