import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: Request) {
  try {
    const { wallet, currency, tx_hash, ref_code } = await request.json();
    if (!wallet || !currency) {
      return NextResponse.json({ success: false, error: 'wallet and currency are required' }, { status: 400 });
    }
    const client = getSupabaseClient();

    // Get settings
    const { data: settings, error: settingsError } = await client.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (settingsError) throw new Error(settingsError.message);
    if (!settings) throw new Error('Settings not found');

    // Get price for currency
    const priceKey = `price_${currency.toLowerCase()}` as keyof typeof settings;
    const price = settings[priceKey] as string;
    if (!price) throw new Error('Invalid currency');

    // Calculate fee
    const feeRate = parseFloat(settings.buy_fee_rate) / 100;
    const feeAmount = (parseFloat(price) * feeRate).toFixed(8);

    // Determine rarity based on probability
    const rand = Math.random() * 100;
    const probNormal = parseFloat(settings.prob_normal);
    const probRare = parseFloat(settings.prob_rare);
    const probEpic = parseFloat(settings.prob_epic);
    const probLegend = parseFloat(settings.prob_legend);

    let rarity: string;
    if (rand < probNormal) {
      rarity = 'normal';
    } else if (rand < probNormal + probRare) {
      rarity = 'rare';
    } else if (rand < probNormal + probRare + probEpic) {
      rarity = 'epic';
    } else if (rand < probNormal + probRare + probEpic + probLegend) {
      rarity = 'legend';
    } else {
      rarity = 'myth';
    }

    // Register or get user
    let user = null;
    const { data: existingUser } = await client.from('users').select('*').eq('wallet_address', wallet).maybeSingle();

    if (existingUser) {
      user = existingUser;
    } else {
      // Generate referral code
      const referralCode = wallet.slice(2, 10).toUpperCase();

      // Handle referral
      let parentCode = ref_code || null;
      let parentL2Code = null;
      let parentL3Code = null;

      if (parentCode) {
        const { data: parentUser } = await client.from('users').select('parent_code, referral_code').eq('referral_code', parentCode).maybeSingle();
        if (parentUser) {
          // Level 2 = parent's parent
          if (parentUser.parent_code) {
            parentL2Code = parentUser.parent_code;
            // Level 3 = parent's L2 parent
            const { data: l2User } = await client.from('users').select('parent_code').eq('referral_code', parentUser.parent_code).maybeSingle();
            if (l2User?.parent_code) {
              parentL3Code = l2User.parent_code;
            }
          }
        }
      }

      const { data: newUser, error: userError } = await client.from('users').insert({
        wallet_address: wallet,
        referral_code: referralCode,
        parent_code: parentCode,
        parent_l2_code: parentL2Code,
        parent_l3_code: parentL3Code,
      }).select().single();
      if (userError) throw new Error(userError.message);
      user = newUser;
    }

    // Create NFT in inventory
    const { data: nft, error: nftError } = await client.from('nft_inventory').insert({
      wallet_address: wallet,
      rarity,
      purchase_price: price,
      purchase_currency: currency.toUpperCase(),
      status: 'held',
    }).select().single();
    if (nftError) throw new Error(nftError.message);

    // Create transaction record
    await client.from('transactions').insert({
      wallet_address: wallet,
      type: 'buy_blindbox',
      amount: price,
      currency: currency.toUpperCase(),
      fee_amount: feeAmount,
      nft_id: nft.id,
      tx_hash: tx_hash || null,
      status: 'completed',
    });

    // Update user stats
    await client.from('users').update({
      total_spent: (parseFloat(user.total_spent) + parseFloat(price)).toFixed(8),
      total_boxes: user.total_boxes + 1,
    }).eq('wallet_address', wallet);

    // Distribute commissions
    if (user.parent_code) {
      const commissionL1 = (parseFloat(price) * parseFloat(settings.commission_l1) / 100).toFixed(8);
      const { data: l1User } = await client.from('users').select('wallet_address, commission_balance, total_commission').eq('referral_code', user.parent_code).maybeSingle();
      if (l1User) {
        await client.from('commissions').insert({
          wallet_address: l1User.wallet_address,
          from_wallet: wallet,
          level: 1,
          amount: commissionL1,
          currency: currency.toUpperCase(),
          status: 'settled',
        });
        await client.from('users').update({
          commission_balance: (parseFloat(l1User.commission_balance) + parseFloat(commissionL1)).toFixed(8),
          total_commission: (parseFloat(l1User.total_commission) + parseFloat(commissionL1)).toFixed(8),
        }).eq('wallet_address', l1User.wallet_address);
      }
    }

    if (user.parent_l2_code) {
      const commissionL2 = (parseFloat(price) * parseFloat(settings.commission_l2) / 100).toFixed(8);
      const { data: l2User } = await client.from('users').select('wallet_address, commission_balance, total_commission').eq('referral_code', user.parent_l2_code).maybeSingle();
      if (l2User) {
        await client.from('commissions').insert({
          wallet_address: l2User.wallet_address,
          from_wallet: wallet,
          level: 2,
          amount: commissionL2,
          currency: currency.toUpperCase(),
          status: 'settled',
        });
        await client.from('users').update({
          commission_balance: (parseFloat(l2User.commission_balance) + parseFloat(commissionL2)).toFixed(8),
          total_commission: (parseFloat(l2User.total_commission) + parseFloat(commissionL2)).toFixed(8),
        }).eq('wallet_address', l2User.wallet_address);
      }
    }

    if (user.parent_l3_code) {
      const commissionL3 = (parseFloat(price) * parseFloat(settings.commission_l3) / 100).toFixed(8);
      const { data: l3User } = await client.from('users').select('wallet_address, commission_balance, total_commission').eq('referral_code', user.parent_l3_code).maybeSingle();
      if (l3User) {
        await client.from('commissions').insert({
          wallet_address: l3User.wallet_address,
          from_wallet: wallet,
          level: 3,
          amount: commissionL3,
          currency: currency.toUpperCase(),
          status: 'settled',
        });
        await client.from('users').update({
          commission_balance: (parseFloat(l3User.commission_balance) + parseFloat(commissionL3)).toFixed(8),
          total_commission: (parseFloat(l3User.total_commission) + parseFloat(commissionL3)).toFixed(8),
        }).eq('wallet_address', l3User.wallet_address);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        nft_id: nft.id,
        rarity,
        price,
        currency: currency.toUpperCase(),
        fee: feeAmount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
