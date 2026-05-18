import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendPayoutToUser, getPlatformBalance } from '@/lib/blockchain';

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

    // Calculate balance and total from commissions
    const balance = (commissions || []).reduce((sum: number, c: { amount: string }) => sum + parseFloat(c.amount || '0'), 0);
    const total = balance; // All commissions are settled immediately

    // Get team counts
    let teamL1 = 0;
    let teamL2 = 0;
    if (user?.referral_code) {
      const { count: c1 } = await client.from('users').select('*', { count: 'exact', head: true }).eq('parent_code', user.referral_code);
      teamL1 = c1 || 0;
      const { count: c2 } = await client.from('users').select('*', { count: 'exact', head: true }).eq('parent_l2_code', user.referral_code);
      teamL2 = c2 || 0;
    }

    // Get settings for rates
    const { data: settings } = await client.from('admin_settings').select('commission_l1, commission_l2, referral_enabled, min_withdraw').eq('id', 1).maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        user: user || null,
        commission_balance: balance.toFixed(8),
        total_commission: total.toFixed(8),
        commissions: commissions || [],
        team: { l1: teamL1, l2: teamL2 },
        rates: {
          l1: settings?.commission_l1 || '4',
          l2: settings?.commission_l2 || '1',
        },
        referral_enabled: settings?.referral_enabled ?? true,
        min_withdraw: settings?.min_withdraw || '5',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json() as { wallet: string };
    const client = getSupabaseClient();

    // Get user
    const { data: user } = await client.from('users').select('*').eq('wallet_address', wallet).maybeSingle();
    if (!user) throw new Error('User not found');

    // Calculate balance from commissions
    const { data: commissions } = await client.from('commissions').select('amount').eq('wallet_address', wallet);
    const balance = (commissions || []).reduce((sum: number, c: { amount: string }) => sum + parseFloat(c.amount || '0'), 0);
    if (balance <= 0) throw new Error('No commission to withdraw');

    // Get settings
    const { data: settings } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (!settings) throw new Error('Settings not found');

    // Check min withdrawal
    const minWithdraw = parseFloat(settings.min_withdraw);
    if (balance < minWithdraw) throw new Error(`Minimum withdrawal is ${minWithdraw} USDT`);

    // Check payout wallet
    if (!settings.payout_wallet) throw new Error('Platform payout wallet not configured');

    // Calculate fee
    const feeRate = parseFloat(settings.withdraw_fee_rate) / 100;
    const feeAmount = (balance * feeRate).toFixed(8);
    const receiveAmount = (balance - parseFloat(feeAmount)).toFixed(8);

    // =============================================
    // AUTO-PAYOUT: Send USDT from payout wallet to user
    // Per spec: "所有收益自动发放BSC-USDT，全自动到账"
    // =============================================
    let payoutTxHash: string | null = null;
    let payoutStatus = 'pending';
    const usdtContract = settings.usdt_contract as string;

    try {
      if (usdtContract && receiveAmount && parseFloat(receiveAmount) > 0) {
        // Check payout wallet balance first
        const balanceStr = await getPlatformBalance('USDT', usdtContract);
        if (parseFloat(balanceStr) < parseFloat(receiveAmount)) {
          throw new Error(`Insufficient USDT in payout wallet. Balance: ${balanceStr}, Required: ${receiveAmount}. Please try again later.`);
        }

        // Execute on-chain payout
        const payoutResult = await sendPayoutToUser(wallet, receiveAmount, 'USDT', usdtContract);
        payoutTxHash = payoutResult.txHash || null;
        payoutStatus = payoutResult.status === 'confirmed' ? 'completed' : 'pending';
      }
    } catch (payoutErr) {
      const payoutErrorMsg = payoutErr instanceof Error ? payoutErr.message : 'Payout failed';
      console.error(`Payout failed for commission withdrawal ${wallet}:`, payoutErrorMsg);

      // Record with payout_failed status so admin knows to process manually
      await client.from('transactions').insert({
        wallet_address: wallet,
        type: 'withdraw_commission',
        amount: balance.toFixed(8),
        currency: 'USDT',
        fee_amount: feeAmount,
        receive_amount: receiveAmount,
        quantity: 1,
        tx_hash: null,
        status: 'payout_failed',
      });

      return NextResponse.json({
        success: false,
        error: `Auto-payout failed: ${payoutErrorMsg}. Your commission withdrawal has been recorded. Please contact admin.`,
      }, { status: 400 });
    }

    // Payout succeeded - delete commissions (already settled)
    await client.from('commissions').delete().eq('wallet_address', wallet);

    // Create transaction with payout tx_hash
    await client.from('transactions').insert({
      wallet_address: wallet,
      type: 'withdraw_commission',
      amount: balance.toFixed(8),
      currency: 'USDT',
      fee_amount: feeAmount,
      receive_amount: receiveAmount,
      quantity: 1,
      tx_hash: payoutTxHash,
      status: payoutStatus === 'confirmed' ? 'completed' : 'pending',
    });

    return NextResponse.json({
      success: true,
      data: {
        amount: balance.toFixed(8),
        fee: feeAmount,
        receive: receiveAmount,
        wallet,
        payout_tx_hash: payoutTxHash,
        payout_status: payoutStatus,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
