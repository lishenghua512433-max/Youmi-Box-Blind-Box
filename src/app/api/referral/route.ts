import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Get user
    const { data: user, error: userError } = await client.from('users').select('*').eq('wallet_address', wallet).maybeSingle();
    if (userError) throw new Error(userError.message);

    // Get commission history
    const { data: commissions, error: commError } = await client.from('commissions').select('*').eq('wallet_address', wallet).order('created_at', { ascending: false }).limit(50);
    if (commError) throw new Error(commError.message);

    // Get team counts
    let teamL1 = 0;
    let teamL2 = 0;
    let teamL3 = 0;
    if (user?.referral_code) {
      const { count: c1 } = await client.from('users').select('*', { count: 'exact', head: true }).eq('parent_code', user.referral_code);
      teamL1 = c1 || 0;
      const { count: c2 } = await client.from('users').select('*', { count: 'exact', head: true }).eq('parent_l2_code', user.referral_code);
      teamL2 = c2 || 0;
      const { count: c3 } = await client.from('users').select('*', { count: 'exact', head: true }).eq('parent_l3_code', user.referral_code);
      teamL3 = c3 || 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        user: user || null,
        commissions: commissions || [],
        team: { l1: teamL1, l2: teamL2, l3: teamL3 },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();
    const client = getSupabaseClient();

    // Get user
    const { data: user, error: userError } = await client.from('users').select('*').eq('wallet_address', wallet).maybeSingle();
    if (userError) throw new Error(userError.message);
    if (!user) throw new Error('User not found');

    const balance = parseFloat(user.commission_balance);
    if (balance <= 0) throw new Error('No commission to withdraw');

    // Get settings
    const { data: settings } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (!settings) throw new Error('Settings not found');

    // Calculate fee
    const feeRate = parseFloat(settings.withdraw_fee_rate) / 100;
    const feeAmount = (balance * feeRate).toFixed(8);
    const receiveAmount = (balance - parseFloat(feeAmount)).toFixed(8);

    // Reset commission balance
    await client.from('users').update({
      commission_balance: '0',
    }).eq('wallet_address', wallet);

    // Create transaction
    await client.from('transactions').insert({
      wallet_address: wallet,
      type: 'withdraw_commission',
      amount: balance.toFixed(8),
      currency: 'BNB',
      fee_amount: feeAmount,
      status: 'completed',
    });

    return NextResponse.json({
      success: true,
      data: {
        amount: balance.toFixed(8),
        fee: feeAmount,
        receive: receiveAmount,
        wallet,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
