import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyOnChainPayment } from '@/lib/blockchain';

const RARITIES = ['fanpin', 'lingpin', 'xuanpin', 'xianpin', 'shenpin'] as const;

function drawRarity(probabilities: Record<string, number>): string {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const r of RARITIES) {
    cumulative += probabilities[r] || 0;
    if (rand < cumulative) return r;
  }
  return RARITIES[RARITIES.length - 1];
}

// Get contract address for a currency from settings
function getContractAddress(settings: Record<string, string | number | boolean>, currency: string): string | undefined {
  const map: Record<string, string> = {
    USDT: settings.usdt_contract as string,
    BUSD: settings.busd_contract as string,
    TRX: settings.trx_contract as string,
  };
  return map[currency.toUpperCase()];
}

export async function POST(request: Request) {
  try {
    const { wallet, currency, tx_hash, ref_code, quantity } = await request.json() as {
      wallet: string;
      currency: string;
      tx_hash?: string;
      ref_code?: string;
      quantity?: number;
    };

    if (!wallet || !currency) {
      return NextResponse.json({ success: false, error: 'wallet and currency are required' }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(99, quantity || 1));
    const client = getSupabaseClient();

    // Get settings
    const { data: settings, error: settingsError } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (settingsError) throw new Error(settingsError.message);
    if (!settings) {
      return NextResponse.json({
        success: false,
        error: 'Platform not configured. Please initialize settings in admin panel first.',
      }, { status: 400 });
    }

    const pricePerBox = parseFloat(settings.price_usdt as string);
    const totalPrice = pricePerBox * qty;

    // =============================================
    // ON-CHAIN PAYMENT VERIFICATION (when tx_hash provided)
    // =============================================
    if (tx_hash) {
      const collectionWallet = settings.collection_wallet as string;
      const contractAddress = getContractAddress(settings, currency);

      const verification = await verifyOnChainPayment({
        txHash: tx_hash,
        expectedFrom: wallet,
        expectedTo: collectionWallet,
        expectedAmount: totalPrice.toFixed(8),
        currency: currency.toUpperCase(),
        contractAddress,
        tolerancePercent: 2, // 2% tolerance for BNB price fluctuation
      });

      if (!verification.valid) {
        return NextResponse.json({
          success: false,
          error: `Payment verification failed: ${verification.reason}`,
          verification,
        }, { status: 400 });
      }
    } else {
      // No tx_hash provided - check if collection_wallet is configured
      // If configured, require payment verification
      if (settings.collection_wallet) {
        return NextResponse.json({
          success: false,
          error: 'Payment verification required. Please provide tx_hash after completing the blockchain payment.',
        }, { status: 400 });
      }
      // If no collection_wallet configured (dev/test mode), allow without verification
    }

    // Build probability map
    const probabilities: Record<string, number> = {};
    for (const r of RARITIES) {
      probabilities[r] = parseFloat(settings[`prob_${r}`] as string) || 0;
    }

    // Register or get user
    let user: { wallet_address: string; referral_code: string; parent_code: string | null; parent_l2_code: string | null } | null = null;
    const { data: existingUser } = await client.from('users').select('*').eq('wallet_address', wallet).maybeSingle();

    if (existingUser) {
      user = existingUser;
    } else {
      const referralCode = wallet.slice(2, 10).toUpperCase();
      let parentCode: string | null = ref_code || null;
      let parentL2Code: string | null = null;

      if (parentCode) {
        const { data: parentUser } = await client.from('users').select('parent_code, referral_code').eq('referral_code', parentCode).maybeSingle();
        if (parentUser) {
          if (parentUser.parent_code) {
            parentL2Code = parentUser.parent_code;
          }
        }
      }

      const { data: newUser, error: userError } = await client.from('users').upsert({
        wallet_address: wallet,
        referral_code: referralCode,
        parent_code: parentCode,
        parent_l2_code: parentL2Code,
      }, { onConflict: 'wallet_address' }).select().single();
      if (userError) throw new Error(userError.message);
      user = newUser;
    }

    // Draw rarities for all boxes
    const results: { rarity: string; nftId: number }[] = [];
    for (let i = 0; i < qty; i++) {
      const rarity = drawRarity(probabilities);
      const { data: nft, error: nftError } = await client.from('nft_inventory').insert({
        wallet_address: wallet,
        rarity,
        purchase_price: pricePerBox.toFixed(8),
        purchase_currency: currency.toUpperCase(),
        status: 'held',
      }).select().single();
      if (nftError) throw new Error(nftError.message);
      results.push({ rarity, nftId: nft.id });
    }

    // Create transaction record (no fee for blind box purchase)
    const txResult = await client.from('transactions').insert({
      wallet_address: wallet,
      type: 'buy_blindbox',
      amount: totalPrice.toFixed(8),
      currency: currency.toUpperCase(),
      fee_amount: '0',
      receive_amount: '0',
      quantity: qty,
      nft_id: results[0].nftId,
      tx_hash: tx_hash || null,
      status: tx_hash ? 'confirmed' : 'completed',
    });
    if (txResult.error) console.error('Transaction insert error:', txResult.error.message);

    // Distribute commissions (only 2 levels, only from direct referral purchases, not self)
    if (!user) throw new Error('User not found');
    const referralEnabled = settings.referral_enabled === true || settings.referral_enabled === 'true';
    if (referralEnabled && user.parent_code) {
      // Level 1 (Direct)
      const commissionL1 = (totalPrice * parseFloat(settings.commission_l1 as string) / 100).toFixed(8);
      const { data: l1User } = await client.from('users').select('wallet_address').eq('referral_code', user.parent_code).maybeSingle();
      if (l1User) {
        await client.from('commissions').insert({
          wallet_address: l1User.wallet_address,
          from_wallet: wallet,
          level: 1,
          amount: commissionL1,
        });
      }

      // Level 2 (Indirect)
      if (user.parent_l2_code) {
        const commissionL2 = (totalPrice * parseFloat(settings.commission_l2 as string) / 100).toFixed(8);
        const { data: l2User } = await client.from('users').select('wallet_address').eq('referral_code', user.parent_l2_code).maybeSingle();
        if (l2User) {
          await client.from('commissions').insert({
            wallet_address: l2User.wallet_address,
            from_wallet: wallet,
            level: 2,
            amount: commissionL2,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        quantity: qty,
        results,
        price_per_box: pricePerBox,
        total_price: totalPrice.toFixed(8),
        currency: currency.toUpperCase(),
        tx_hash: tx_hash || null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
