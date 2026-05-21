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
    // 链下盲盒模式 (Off-chain Blind Box Mode)
    // =============================================
    // 盲盒购买完全链下：
    //   - 用户付款直接转入收款钱包（前端已完成链上转账）
    //   - 平台仅在数据库中生成NFT资产记录，无需链上铸造
    //   - tx_hash 为可选参数：有则验证链上交易，无则直接生成记录
    //
    // 资金流向：盲盒全款 → 收款钱包（collection_wallet）
    // =============================================

    if (tx_hash) {
      // 验证模式：如果前端传了 tx_hash，则验证链上交易
      try {
        const collectionWallet = settings.collection_wallet as string;
        const contractAddress = getContractAddress(settings, currency);

        const verification = await verifyOnChainPayment({
          txHash: tx_hash,
          expectedFrom: wallet,
          expectedTo: collectionWallet,
          expectedAmount: totalPrice.toFixed(8),
          currency: currency.toUpperCase(),
          contractAddress,
          tolerancePercent: 2,
        });

        if (!verification.valid) {
          console.warn(`[blindbox/buy] Payment verification failed for tx ${tx_hash}: ${verification.reason}`);
          // 链下模式：验证失败不阻止购买，仅记录警告
          // 因为链上确认可能有延迟，不阻塞用户体验
        } else {
          console.log(`[blindbox/buy] Payment verified for tx ${tx_hash}, amount: ${verification.actualAmount}`);
        }
      } catch (verifyErr) {
        // 验证过程出错（如RPC不可用），不阻塞购买
        console.warn(`[blindbox/buy] Payment verification error (non-blocking):`, verifyErr instanceof Error ? verifyErr.message : verifyErr);
      }
    }
    // 无 tx_hash 时直接创建记录（链下模式核心：无需链上验证即可购买）

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

    // Draw rarities for all boxes — 链下模式：仅在数据库生成记录，无需链上铸造NFT
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
      status: 'completed',
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
    console.error('[blindbox/buy] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
