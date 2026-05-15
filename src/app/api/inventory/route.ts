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
    const { nft_id, wallet } = await request.json();
    const client = getSupabaseClient();

    // Get NFT
    const { data: nft, error: nftError } = await client.from('nft_inventory').select('*').eq('id', nft_id).eq('wallet_address', wallet).eq('status', 'held').maybeSingle();
    if (nftError) throw new Error(nftError.message);
    if (!nft) throw new Error('NFT not found or already sold');

    // Get settings
    const { data: settings, error: settingsError } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (settingsError) throw new Error(settingsError.message);
    if (!settings) throw new Error('Settings not found');

    // Get recycle price for rarity
    const recycleKey = `recycle_${nft.rarity}` as keyof typeof settings;
    const recyclePrice = parseFloat(settings[recycleKey] as string);

    // Calculate fee
    const feeRate = parseFloat(settings.sell_fee_rate) / 100;
    const feeAmount = (recyclePrice * feeRate).toFixed(8);
    const receiveAmount = (recyclePrice - parseFloat(feeAmount)).toFixed(8);

    // Update NFT status
    const { error: updateError } = await client.from('nft_inventory').update({
      status: 'sold',
      sold_price: recyclePrice.toFixed(8),
      sold_at: new Date().toISOString(),
    }).eq('id', nft_id);
    if (updateError) throw new Error(updateError.message);

    // Create transaction
    await client.from('transactions').insert({
      wallet_address: wallet,
      type: 'sell_nft',
      amount: recyclePrice.toFixed(8),
      currency: 'BNB',
      fee_amount: feeAmount,
      nft_id,
      status: 'completed',
    });

    return NextResponse.json({
      success: true,
      data: {
        nft_id,
        rarity: nft.rarity,
        recycle_price: recyclePrice.toFixed(8),
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
