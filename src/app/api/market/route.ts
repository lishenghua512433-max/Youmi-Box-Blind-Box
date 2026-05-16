import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: list all active market listings
export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('trade_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: buy from market listing
export async function POST(request: Request) {
  try {
    const { listing_id, buyer_wallet } = await request.json() as { listing_id: number; buyer_wallet: string };
    if (!listing_id || !buyer_wallet) {
      return NextResponse.json({ success: false, error: 'listing_id and buyer_wallet required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Get listing
    const { data: listing, error: listingError } = await client.from('trade_listings').select('*').eq('id', listing_id).eq('status', 'active').maybeSingle();
    if (listingError) throw new Error(listingError.message);
    if (!listing) throw new Error('Listing not found or already sold');
    if (listing.seller_wallet === buyer_wallet) throw new Error('Cannot buy your own listing');

    // Get settings
    const { data: settings } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (!settings) throw new Error('Settings not found');

    const price = parseFloat(listing.price);
    const feeRate = parseFloat(settings.trade_fee_rate) / 100;
    const buyerFee = (price * feeRate).toFixed(8);
    const sellerFee = (price * feeRate).toFixed(8);
    const sellerReceive = (price - parseFloat(sellerFee)).toFixed(8);

    // Update listing status
    await client.from('trade_listings').update({ status: 'sold' }).eq('id', listing_id);

    // Transfer NFT to buyer
    await client.from('nft_inventory').update({
      wallet_address: buyer_wallet,
      status: 'held',
    }).eq('id', listing.nft_id);

    // Record buyer transaction
    await client.from('transactions').insert({
      wallet_address: buyer_wallet,
      type: 'market_buy',
      amount: price.toFixed(8),
      currency: 'USDT',
      fee_amount: buyerFee,
      receive_amount: '0',
      quantity: 1,
      nft_id: listing.nft_id,
      related_wallet: listing.seller_wallet,
      status: 'completed',
    });

    // Record seller transaction
    await client.from('transactions').insert({
      wallet_address: listing.seller_wallet,
      type: 'market_sell',
      amount: price.toFixed(8),
      currency: 'USDT',
      fee_amount: sellerFee,
      receive_amount: sellerReceive,
      quantity: 1,
      nft_id: listing.nft_id,
      related_wallet: buyer_wallet,
      status: 'completed',
    });

    return NextResponse.json({
      success: true,
      data: {
        nft_id: listing.nft_id,
        rarity: listing.rarity,
        price: price.toFixed(8),
        buyer_fee: buyerFee,
        seller_fee: sellerFee,
        seller_receive: sellerReceive,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
