import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendPayoutToUser, getPlatformBalance, verifyOnChainPayment, executeTradeSplit } from '@/lib/blockchain';

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
    const { listing_id, buyer_wallet, tx_hash } = await request.json() as { listing_id: number; buyer_wallet: string; tx_hash?: string };
    if (!listing_id || !buyer_wallet) {
      return NextResponse.json({ success: false, error: 'listing_id and buyer_wallet required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Get listing
    const { data: listing, error: listingError } = await client.from('trade_listings').select('*').eq('id', listing_id).eq('status', 'active').maybeSingle();
    if (listingError) throw new Error(listingError.message);
    if (!listing) return NextResponse.json({ success: false, error: 'Listing not found or already sold' }, { status: 400 });
    if (listing.seller_wallet === buyer_wallet) return NextResponse.json({ success: false, error: 'Cannot buy your own listing' }, { status: 400 });

    // Get settings
    const { data: settings } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (!settings) throw new Error('Settings not found');

    const price = parseFloat(listing.price);
    const feeRate = parseFloat(settings.trade_fee_rate) / 100;
    const buyerFee = (price * feeRate).toFixed(8);
    const sellerFee = (price * feeRate).toFixed(8);
    const sellerReceive = (price - parseFloat(sellerFee)).toFixed(8);
    const buyerTotal = (price + parseFloat(buyerFee)).toFixed(8);
    const usdtContract = settings.usdt_contract as string;

    // =============================================
    // Step 1: Verify buyer's on-chain payment to collection_wallet
    // Frontend sends tx_hash after buyer confirms MetaMask payment
    // =============================================
    let buyerTxHash: string | null = tx_hash || null;
    if (buyerTxHash && settings.collection_wallet && usdtContract) {
      try {
        const paymentVerified = await verifyOnChainPayment({
          txHash: buyerTxHash,
          expectedFrom: buyer_wallet,
          expectedTo: settings.collection_wallet as string,
          expectedAmount: buyerTotal,
          currency: 'USDT',
          contractAddress: usdtContract,
        });
        if (!paymentVerified.valid) {
          return NextResponse.json({
            success: false,
            error: `Payment verification failed: ${paymentVerified.reason}. Please ensure you have paid the correct amount.`,
          }, { status: 400 });
        }
        // Payment verified, keep the tx_hash
      } catch (verifyErr) {
        console.error('Payment verification error:', verifyErr);
        // Continue without verification if RPC fails - log warning
        console.warn(`Could not verify payment for market buy listing ${listing_id}, tx_hash: ${buyerTxHash}`);
      }
    }

    // =============================================
    // Step 2: Auto-payout to seller from payout_wallet
    // Per spec: "卖家实收金额自动到账"
    // =============================================
    let sellerPayoutTxHash: string | null = null;
    let sellerPayoutStatus = 'pending';

    if (settings.payout_wallet && usdtContract && parseFloat(sellerReceive) > 0) {
      try {
        // Check payout wallet balance
        const balanceStr = await getPlatformBalance('USDT', usdtContract);
        if (parseFloat(balanceStr) < parseFloat(sellerReceive)) {
          console.warn(`Insufficient platform balance for seller payout. Balance: ${balanceStr}, Required: ${sellerReceive}`);
          sellerPayoutStatus = 'payout_pending';
        } else {
          // Execute trade split: platform pays seller their share (fee kept in platform wallet)
          const tradeResult = await executeTradeSplit(listing.seller_wallet, String(price), settings.trade_fee_rate, 'USDT');
          sellerPayoutTxHash = tradeResult.sellerTxHash;
          sellerPayoutStatus = 'completed';
        }
      } catch (payoutErr) {
        console.error(`Seller payout failed for listing ${listing_id}:`, payoutErr);
        sellerPayoutStatus = 'payout_failed';
      }
    }

    // Update listing status
    const { error: updateListingError } = await client.from('trade_listings').update({ status: 'sold' }).eq('id', listing_id);
    if (updateListingError) throw new Error(updateListingError.message);

    // Transfer NFT to buyer
    const { error: transferError } = await client.from('nft_inventory').update({
      wallet_address: buyer_wallet,
      status: 'held',
    }).eq('id', listing.nft_id);
    if (transferError) throw new Error(transferError.message);

    // Record buyer transaction
    const { error: buyerTxError } = await client.from('transactions').insert({
      wallet_address: buyer_wallet,
      type: 'market_buy',
      amount: buyerTotal,
      currency: 'USDT',
      fee_amount: buyerFee,
      receive_amount: '0',
      quantity: 1,
      nft_id: listing.nft_id,
      related_wallet: listing.seller_wallet,
      tx_hash: buyerTxHash,
      status: 'completed',
    });
    if (buyerTxError) console.error('Buyer transaction error:', buyerTxError.message);

    // Record seller transaction
    const { error: sellerTxError } = await client.from('transactions').insert({
      wallet_address: listing.seller_wallet,
      type: 'market_sell',
      amount: price.toFixed(8),
      currency: 'USDT',
      fee_amount: sellerFee,
      receive_amount: sellerReceive,
      quantity: 1,
      nft_id: listing.nft_id,
      related_wallet: buyer_wallet,
      tx_hash: sellerPayoutTxHash,
      status: sellerPayoutStatus,
    });
    if (sellerTxError) console.error('Seller transaction error:', sellerTxError.message);

    return NextResponse.json({
      success: true,
      data: {
        nft_id: listing.nft_id,
        rarity: listing.rarity,
        price: price.toFixed(8),
        buyer_fee: buyerFee,
        buyer_total: buyerTotal,
        seller_fee: sellerFee,
        seller_receive: sellerReceive,
        buyer_tx_hash: buyerTxHash,
        seller_payout_tx_hash: sellerPayoutTxHash,
        seller_payout_status: sellerPayoutStatus,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
