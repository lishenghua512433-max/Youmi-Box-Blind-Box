import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

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
      // Platform recycle
      const { data: nft, error: nftError } = await client.from('nft_inventory').select('*').eq('id', nft_id).eq('wallet_address', wallet).eq('status', 'held').maybeSingle();
      if (nftError) throw new Error(nftError.message);
      if (!nft) throw new Error('NFT not found or not held');

      // Check payout wallet configured
      if (!settings.payout_wallet) return NextResponse.json({ success: false, error: 'Platform payout wallet not configured' }, { status: 400 });

      const recycleKey = `recycle_${nft.rarity}` as keyof typeof settings;
      const recyclePrice = parseFloat(settings[recycleKey] as string);
      const feeRate = parseFloat(settings.recycle_fee_rate) / 100;
      const feeAmount = (recyclePrice * feeRate).toFixed(8);
      const receiveAmount = (recyclePrice - parseFloat(feeAmount)).toFixed(8);

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
        status: 'completed',
      });

      return NextResponse.json({
        success: true,
        data: { nft_id, rarity: nft.rarity, recycle_price: recyclePrice.toFixed(8), fee: feeAmount, receive: receiveAmount, wallet },
      });
    }

    if (action === 'list') {
      // List on market
      const price = body.price;
      if (!price || price <= 0) throw new Error('Invalid listing price');

      const { data: nft, error: nftError } = await client.from('nft_inventory').select('*').eq('id', nft_id).eq('wallet_address', wallet).eq('status', 'held').maybeSingle();
      if (nftError) throw new Error(nftError.message);
      if (!nft) throw new Error('NFT not found or not held');

      await client.from('nft_inventory').update({ status: 'listed' }).eq('id', nft_id);
      await client.from('trade_listings').insert({
        nft_id,
        seller_wallet: wallet,
        rarity: nft.rarity,
        price: price.toFixed(8),
        status: 'active',
      });

      return NextResponse.json({ success: true, data: { nft_id, price: price.toFixed(8) } });
    }

    if (action === 'gift') {
      // Gift NFT
      const giftTo = body.gift_to;
      if (!giftTo) throw new Error('Recipient wallet required');

      const { data: nft, error: nftError } = await client.from('nft_inventory').select('*').eq('id', nft_id).eq('wallet_address', wallet).eq('status', 'held').maybeSingle();
      if (nftError) throw new Error(nftError.message);
      if (!nft) throw new Error('NFT not found or not held');

      await client.from('nft_inventory').update({
        wallet_address: giftTo,
        status: 'gifted',
        gifted_to: giftTo,
        gifted_at: new Date().toISOString(),
      }).eq('id', nft_id);

      await client.from('transactions').insert({
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
      const { data: listing } = await client.from('trade_listings').select('*').eq('nft_id', nft_id).eq('seller_wallet', wallet).eq('status', 'active').maybeSingle();
      if (!listing) throw new Error('Active listing not found');

      await client.from('trade_listings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', listing.id);
      await client.from('nft_inventory').update({ status: 'held' }).eq('id', nft_id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
