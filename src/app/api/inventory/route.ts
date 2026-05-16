import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendPayoutToUser, checkPayoutBalance } from '@/lib/blockchain';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const status = searchParams.get('status');
    if (!wallet) {
      return NextResponse.json({ success: false, error: 'Wallet required' }, { status: 400 });
    }

    const client = getSupabaseClient();
    let query = client.from('nft_inventory').select('*').eq('wallet_address', wallet).order('created_at', { ascending: false });
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action: 'sell' | 'list' | 'gift' | 'cancel_listing';
      nft_id: number;
      wallet: string;
      price?: number;
      gift_to?: string;
    };
    const { action, nft_id, wallet } = body;
    const client = getSupabaseClient();

    // Get settings
    const { data: settings } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (!settings) throw new Error('Settings not found');

    if (action === 'sell') {
      // Platform recycle with auto-payout
      const { data: nft, error: nftError } = await client.from('nft_inventory').select('*').eq('id', nft_id).eq('wallet_address', wallet).eq('status', 'held').maybeSingle();
      if (nftError) throw new Error(nftError.message);
      if (!nft) return NextResponse.json({ success: false, error: 'NFT not found or not held' }, { status: 400 });

      // Check payout wallet configured
      if (!settings.payout_wallet) return NextResponse.json({ success: false, error: 'Platform payout wallet not configured' }, { status: 400 });

      const recycleKey = `recycle_${nft.rarity}` as keyof typeof settings;
      const recyclePrice = parseFloat(settings[recycleKey] as string);
      const feeRate = parseFloat(settings.recycle_fee_rate as string) / 100;
      const feeAmount = (recyclePrice * feeRate).toFixed(8);
      const receiveAmount = (recyclePrice - parseFloat(feeAmount)).toFixed(8);

      // =============================================
      // AUTO-PAYOUT: Send USDT from payout wallet to user
      // Per spec: "所有收益自动发放BSC-USDT，全自动到账"
      // =============================================
      let payoutTxHash: string | null = null;
      let payoutStatus = 'pending';

      try {
        const usdtContract = settings.usdt_contract as string;
        if (usdtContract && receiveAmount && parseFloat(receiveAmount) > 0) {
          // Check payout wallet balance first
          const balanceCheck = await checkPayoutBalance(receiveAmount, 'USDT', usdtContract);
          if (!balanceCheck.sufficient) {
            return NextResponse.json({
              success: false,
              error: `Insufficient USDT in payout wallet. Balance: ${balanceCheck.balance} USDT, Required: ${balanceCheck.required} USDT. Please contact admin.`,
            }, { status: 400 });
          }

          // Execute on-chain payout
          const payoutResult = await sendPayoutToUser(wallet, receiveAmount, 'USDT', usdtContract);
          payoutTxHash = payoutResult.txHash;
          payoutStatus = payoutResult.status;
        }
      } catch (payoutErr) {
        const payoutErrorMsg = payoutErr instanceof Error ? payoutErr.message : 'Payout failed';
        // If payout fails, still mark as pending (admin can manually process)
        console.error(`Payout failed for sell_nft ${nft_id}:`, payoutErrorMsg);
        payoutStatus = 'payout_failed';

        // Record with pending status so admin knows payout didn't go through
        await client.from('nft_inventory').update({
          status: 'sold',
          sold_at: new Date().toISOString(),
        }).eq('id', nft_id);

        await client.from('transactions').insert({
          wallet_address: wallet,
          type: 'sell_nft',
          amount: recyclePrice.toFixed(8),
          currency: 'USDT',
          fee_amount: feeAmount,
          receive_amount: receiveAmount,
          quantity: 1,
          nft_id,
          tx_hash: null,
          status: 'payout_failed',
        });

        return NextResponse.json({
          success: false,
          error: `Auto-payout failed: ${payoutErrorMsg}. Your NFT has been recorded as sold. Please contact admin for manual payout.`,
          data: { nft_id, rarity: nft.rarity, recycle_price: recyclePrice.toFixed(8), fee: feeAmount, receive: receiveAmount, payout_status: 'failed' },
        }, { status: 400 });
      }

      // Payout succeeded - update NFT status
      const { error: sellUpdateError } = await client.from('nft_inventory').update({
        status: 'sold',
        sold_at: new Date().toISOString(),
      }).eq('id', nft_id);
      if (sellUpdateError) throw new Error(sellUpdateError.message);

      // Record transaction with payout tx_hash
      const { error: sellTxError } = await client.from('transactions').insert({
        wallet_address: wallet,
        type: 'sell_nft',
        amount: recyclePrice.toFixed(8),
        currency: 'USDT',
        fee_amount: feeAmount,
        receive_amount: receiveAmount,
        quantity: 1,
        nft_id,
        tx_hash: payoutTxHash,
        status: payoutStatus === 'confirmed' ? 'completed' : 'pending',
      });
      if (sellTxError) console.error('Sell transaction error:', sellTxError.message);

      return NextResponse.json({
        success: true,
        data: {
          nft_id,
          rarity: nft.rarity,
          recycle_price: recyclePrice.toFixed(8),
          fee: feeAmount,
          receive: receiveAmount,
          payout_tx_hash: payoutTxHash,
          payout_status: payoutStatus,
          wallet,
        },
      });
    }

    if (action === 'list') {
      // List on market
      const price = body.price;
      if (!price || price <= 0) return NextResponse.json({ success: false, error: 'Invalid listing price' }, { status: 400 });

      const { data: nft, error: nftError } = await client.from('nft_inventory').select('*').eq('id', nft_id).eq('wallet_address', wallet).eq('status', 'held').maybeSingle();
      if (nftError) throw new Error(nftError.message);
      if (!nft) return NextResponse.json({ success: false, error: 'NFT not found or not held' }, { status: 400 });

      const { error: updateStatusError } = await client.from('nft_inventory').update({ status: 'listed' }).eq('id', nft_id);
      if (updateStatusError) throw new Error(updateStatusError.message);
      const { error: insertListingError } = await client.from('trade_listings').insert({
        nft_id,
        seller_wallet: wallet,
        rarity: nft.rarity,
        price: price.toFixed(8),
        status: 'active',
      });
      if (insertListingError) throw new Error(insertListingError.message);

      return NextResponse.json({ success: true, data: { nft_id, price: price.toFixed(8) } });
    }

    if (action === 'gift') {
      // Gift NFT
      const giftTo = body.gift_to;
      if (!giftTo) return NextResponse.json({ success: false, error: 'Recipient wallet required' }, { status: 400 });
      if (giftTo.toLowerCase() === wallet.toLowerCase()) return NextResponse.json({ success: false, error: 'Cannot gift to yourself' }, { status: 400 });

      const { data: nft, error: nftError } = await client.from('nft_inventory').select('*').eq('id', nft_id).eq('wallet_address', wallet).eq('status', 'held').maybeSingle();
      if (nftError) throw new Error(nftError.message);
      if (!nft) return NextResponse.json({ success: false, error: 'NFT not found or not held' }, { status: 400 });

      const { error: giftUpdateError } = await client.from('nft_inventory').update({
        wallet_address: giftTo,
        status: 'held',
        gifted_to: giftTo,
        gifted_at: new Date().toISOString(),
      }).eq('id', nft_id);
      if (giftUpdateError) throw new Error(giftUpdateError.message);

      const { error: giftTxError } = await client.from('transactions').insert({
        wallet_address: wallet,
        type: 'gift_nft',
        amount: '0',
        currency: 'USDT',
        fee_amount: '0',
        receive_amount: '0',
        quantity: 1,
        nft_id,
        related_wallet: giftTo,
        status: 'completed',
      });

      return NextResponse.json({ success: true, data: { nft_id, from: wallet, to: giftTo } });
    }

    if (action === 'cancel_listing') {
      // Cancel market listing
      const { data: listing, error: listingQueryError } = await client.from('trade_listings').select('*').eq('nft_id', nft_id).eq('seller_wallet', wallet).eq('status', 'active').maybeSingle();
      if (listingQueryError) throw new Error(listingQueryError.message);
      if (!listing) return NextResponse.json({ success: false, error: 'Active listing not found' }, { status: 400 });

      const { error: cancelError } = await client.from('trade_listings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', listing.id);
      if (cancelError) throw new Error(cancelError.message);
      const { error: restoreError } = await client.from('nft_inventory').update({ status: 'held' }).eq('id', nft_id);
      if (restoreError) throw new Error(restoreError.message);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
