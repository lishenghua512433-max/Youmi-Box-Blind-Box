'use client';

import { useState, useEffect, useCallback } from 'react';
import { i18n, Lang, t } from '@/lib/i18n';
import { connectWallet, disconnectWallet, isBSCNetwork, switchToBSC, sendPayment, CURRENCIES, Currency, CURRENCY_DECIMALS } from '@/lib/web3';

const RARITIES = ['fanpin', 'lingpin', 'xuanpin', 'xianpin', 'shenpin'] as const;
const RARITY_COLORS: Record<string, string> = {
  fanpin: 'text-gray-400 border-gray-500',
  lingpin: 'text-blue-400 border-blue-500',
  xuanpin: 'text-purple-400 border-purple-500',
  xianpin: 'text-yellow-400 border-yellow-500',
  shenpin: 'text-red-400 border-red-500',
};
const RARITY_BG: Record<string, string> = {
  fanpin: 'bg-gray-500/10',
  lingpin: 'bg-blue-500/10',
  xuanpin: 'bg-purple-500/10',
  xianpin: 'bg-yellow-500/10',
  shenpin: 'bg-red-500/10',
};

type Tab = 'blindbox' | 'inventory' | 'market' | 'referral' | 'history';

interface Settings {
  price_usdt: string;
  prob_fanpin: string; prob_lingpin: string; prob_xuanpin: string; prob_xianpin: string; prob_shenpin: string;
  recycle_fanpin: string; recycle_lingpin: string; recycle_xuanpin: string; recycle_xianpin: string; recycle_shenpin: string;
  trade_fee_rate: string; recycle_fee_rate: string; withdraw_fee_rate: string;
  commission_l1: string; commission_l2: string;
  referral_enabled: boolean;
  min_withdraw: string;
  collection_wallet: string; payout_wallet: string;
  usdt_contract: string; busd_contract: string; trx_contract: string;
  [key: string]: string | boolean | undefined;
}

export default function HomePage() {
  const [lang, setLang] = useState<Lang>('en');
  const [tab, setTab] = useState<Tab>('blindbox');
  const [wallet, setWallet] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});

  // Blind box state
  const [currency, setCurrency] = useState<Currency>('USDT');
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [openResult, setOpenResult] = useState<{ rarity: string; quantity: number } | null>(null);

  // Inventory state
  const [inventory, setInventory] = useState<Record<string, unknown>[]>([]);
  const [inventoryFilter, setInventoryFilter] = useState('held');
  const [sellModal, setSellModal] = useState<Record<string, unknown> | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [actionError, setActionError] = useState('');
  const [giftTo, setGiftTo] = useState('');
  const [actionType, setActionType] = useState<'sell' | 'list' | 'gift' | null>(null);

  // Market state
  const [listings, setListings] = useState<Record<string, unknown>[]>([]);

  // Referral state
  const [referralData, setReferralData] = useState<Record<string, unknown> | null>(null);

  // Redirect sensitive tabs when wallet disconnects
  useEffect(() => {
    if (!wallet && (tab === 'referral' || tab === 'history')) {
      setTab('blindbox');
    }
  }, [wallet, tab]);

  const isBot = mounted && /bot|crawl|spider|slurp|mediapartners|whatsapp|telegram|facebookexternalhit|facebot|discordbot|linkedinbot|twitterbot|pinterest|slackbot|preview|headless|scrapy|curl|wget|python|httpclient|okhttp|sitechecker|semrush|ahrefs|lighthouse|chrome-lighthouse/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const json = await res.json();
      if (json.success) setSettings(json.data);
    } catch { /* ignore */ }
  }, []);

  const loadImages = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/images');
      const json = await res.json();
      if (json.success) {
        const map: Record<string, string> = {};
        (json.data as { rarity: string; image_url: string }[]).forEach((img) => { map[img.rarity] = img.image_url; });
        setImages(map);
      }
    } catch { /* ignore */ }
  }, []);

  const loadInventory = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/inventory?wallet=${wallet}&status=${inventoryFilter}`);
      const json = await res.json();
      if (json.success) setInventory(json.data || []);
    } catch { /* ignore */ }
  }, [wallet, inventoryFilter]);

  const loadMarket = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      const json = await res.json();
      if (json.success) setListings(json.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadReferral = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/referral?wallet=${wallet}`);
      const json = await res.json();
      if (json.success) setReferralData(json.data);
    } catch { /* ignore */ }
  }, [wallet]);

  const [txHistory, setTxHistory] = useState<Array<Record<string, unknown>>>([]);
  const loadTransactions = async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/transactions?wallet=${wallet}`);
      const json = await res.json();
      if (json.success) setTxHistory(json.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { loadSettings(); loadImages(); }, [loadSettings, loadImages]);
  useEffect(() => { if (wallet) loadInventory(); }, [wallet, loadInventory]);
  useEffect(() => { if (tab === 'market') loadMarket(); }, [tab, loadMarket]);
  useEffect(() => { if (tab === 'referral' && wallet) loadReferral(); }, [tab, wallet, loadReferral]);
  useEffect(() => { if (tab === 'history' && wallet) loadTransactions(); }, [tab, wallet]);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) setWallet(addr);
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    setWallet(null);
    setTab('blindbox');
  };

  const handleBuy = async () => {
    if (!wallet || !settings) return;
    setBuying(true);
    setOpenResult(null);
    try {
      const onBsc = await isBSCNetwork();
      if (!onBsc) await switchToBSC();

      // Get contract address for currency
      const contractMap: Record<string, string> = { USDT: settings.usdt_contract, BUSD: settings.busd_contract, TRX: settings.trx_contract };
      const contractAddr = contractMap[currency] || '';

      // Send payment to collection wallet
      if (settings.collection_wallet) {
        const txHash = await sendPayment(currency, contractAddr, settings.collection_wallet, (parseFloat(settings.price_usdt) * quantity).toFixed(8));
        if (!txHash && currency !== 'BNB') {
          // For ERC20, try anyway (user may have already approved)
        }
      }

      const res = await fetch('/api/blindbox/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, currency, quantity, tx_hash: '' }),
      });
      const json = await res.json();
      if (json.success) {
        setOpenResult({ rarity: json.data.results[0].rarity, quantity: json.data.quantity });
        loadSettings();
        loadInventory();
      }
    } catch { /* ignore */ }
    setBuying(false);
  };

  const handleSell = async (nftId: number) => {
    if (!wallet) return;
    setActionError('');
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sell', nft_id: nftId, wallet }),
      });
      const json = await res.json();
      if (json.success) { setSellModal(null); loadInventory(); loadSettings(); }
      else { setActionError(json.error || 'Sell failed'); }
    } catch (err) { setActionError('Network error'); }
  };

  const handleList = async (nftId: number) => {
    if (!wallet || !listPrice) return;
    setActionError('');
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', nft_id: nftId, wallet, price: parseFloat(listPrice) }),
      });
      const json = await res.json();
      if (json.success) { setSellModal(null); setListPrice(''); loadInventory(); }
      else { setActionError(json.error || 'List failed'); }
    } catch (err) { setActionError('Network error'); }
  };

  const handleGift = async (nftId: number) => {
    if (!wallet || !giftTo) return;
    setActionError('');
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gift', nft_id: nftId, wallet, gift_to: giftTo }),
      });
      const json = await res.json();
      if (json.success) { setSellModal(null); setGiftTo(''); loadInventory(); }
      else { setActionError(json.error || 'Gift failed'); }
    } catch (err) { setActionError('Network error'); }
  };

  const handleCancelListing = async (nftId: number) => {
    if (!wallet) return;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_listing', nft_id: nftId, wallet }),
      });
      const json = await res.json();
      if (json.success) loadInventory();
    } catch { /* ignore */ }
  };

  const handleMarketBuy = async (listingId: number) => {
    if (!wallet) return;
    try {
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, buyer_wallet: wallet }),
      });
      const json = await res.json();
      if (json.success) { loadMarket(); loadInventory(); }
    } catch { /* ignore */ }
  };

  const handleWithdraw = async () => {
    if (!wallet) return;
    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      const json = await res.json();
      if (json.success) loadReferral();
    } catch { /* ignore */ }
  };

  // Bot page - simple clean page without sensitive content
  if (isBot) {
    return (
      <div className="min-h-screen bg-[#0f0b1e] flex items-center justify-center">
        <div className="text-center px-6 max-w-md">
          <h1 className="text-2xl font-bold text-white mb-3">{t('app.title', lang)}</h1>
          <p className="text-gray-400 text-sm mb-6">{t('app.subtitle', lang)}</p>
          <p className="text-gray-600 text-xs leading-relaxed">
            {lang === 'zh'
              ? '优秘盒盲盒是一款基于区块链技术的数字藏品盲盒体验平台，所有数字藏品均为链上NFT资产。本平台不提供任何投资建议，不承诺收益保障，用户应充分了解数字资产风险后自主决策。请通过官方渠道访问。'
              : 'Youmi Box Blind Box is a digital collectible blind box experience platform based on blockchain technology. All digital collectibles are on-chain NFT assets. This platform does not provide investment advice, does not guarantee returns, and users should make independent decisions after fully understanding digital asset risks. Please access through official channels.'}
          </p>
        </div>
      </div>
    );
  }

  const quickQty = [1, 5, 10, 25, 50, 99];

  return (
    <div className="min-h-screen bg-[#0f0b1e] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0b1e]/95 backdrop-blur border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{t('app.title', lang)}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5">{t('lang.switch', lang)}</button>
            {wallet ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-green-400">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
                <button onClick={handleDisconnect} className="text-xs px-2 py-1 rounded-lg bg-red-600/80 hover:bg-red-500 text-white">{t('nav.disconnect', lang)}</button>
              </div>
            ) : (
              <button onClick={handleConnect} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500">{t('nav.connect', lang)}</button>
            )}
          </div>
        </div>
      </header>

      {/* Subtitle */}
      {!wallet && (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-2 text-center">
          <p className="text-sm text-gray-400">{t('app.subtitle', lang)}</p>
          <button onClick={handleConnect} className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-medium text-sm">{t('nav.connect', lang)}</button>
        </div>
      )}

      {/* Tabs */}
      <nav className="max-w-lg mx-auto px-4 mt-4">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(['blindbox', 'inventory', 'market', ...(wallet ? ['referral', 'history'] as Tab[] : [] as Tab[])] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className={`flex-1 py-2 text-xs font-medium rounded-lg transition ${tab === tb ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{t(`nav.${tb}`, lang)}</button>
          ))}
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* ===== BLIND BOX TAB ===== */}
        {tab === 'blindbox' && settings && (
          <div className="space-y-4">
            {/* Price display */}
            <div className="bg-white/5 rounded-2xl p-5 text-center">
              <p className="text-gray-400 text-xs mb-1">{t('blindbox.price', lang)}</p>
              <p className="text-3xl font-bold">{settings.price_usdt} <span className="text-base text-gray-400">USDT</span></p>
              <p className="text-xs text-gray-500 mt-1">{t('common.network', lang)}</p>
            </div>

            {/* Currency select */}
            <div>
              <p className="text-xs text-gray-400 mb-2">{t('blindbox.select.currency', lang)}</p>
              <div className="grid grid-cols-4 gap-2">
                {CURRENCIES.map((c) => (
                  <button key={c} onClick={() => setCurrency(c)} className={`py-2 rounded-xl text-sm font-medium border transition ${currency === c ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <p className="text-xs text-gray-400 mb-2">{t('blindbox.quantity', lang)}</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {quickQty.map((q) => (
                  <button key={q} onClick={() => setQuantity(q)} className={`px-3 py-1.5 rounded-lg text-xs border transition ${quantity === q ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}>{q}</button>
                ))}
              </div>
              <input type="number" min={1} max={99} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
            </div>

            {/* Total */}
            <div className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-3">
              <span className="text-gray-400 text-sm">{t('blindbox.total', lang)}</span>
              <span className="font-bold text-lg">{(parseFloat(settings.price_usdt) * quantity).toFixed(2)} USDT</span>
            </div>



            {/* Buy button */}
            <button onClick={handleBuy} disabled={buying || !wallet} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {buying ? t('blindbox.buying', lang) : t('blindbox.buy', lang)}
            </button>
            {!wallet && <p className="text-center text-xs text-gray-500">Please connect wallet first</p>}

            {/* Probability display */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="grid grid-cols-5 gap-1 text-center">
                {RARITIES.map((r) => (
                  <div key={r}>
                    <div className={`text-xs font-medium ${RARITY_COLORS[r]?.split(' ')[0] || 'text-gray-400'}`}>{t(`rarity.${r}`, lang)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Open result modal */}
            {openResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setOpenResult(null)}>
                <div className="bg-[#1a1230] rounded-2xl p-6 text-center max-w-xs mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className={`w-24 h-24 mx-auto rounded-xl border-2 ${RARITY_COLORS[openResult.rarity] || ''} flex items-center justify-center mb-4 overflow-hidden`}>
                    {images[openResult.rarity] ? <img src={images[openResult.rarity]} alt={openResult.rarity} className="w-full h-full object-cover" /> : <span className="text-2xl">?</span>}
                  </div>
                  <p className="text-sm text-gray-400 mb-1">{t('blindbox.result', lang)}</p>
                  <p className={`text-xl font-bold ${RARITY_COLORS[openResult.rarity]?.split(' ')[0] || ''}`}>{t(`rarity.${openResult.rarity}`, lang)}</p>
                  {openResult.quantity > 1 && <p className="text-xs text-gray-500 mt-1">x{openResult.quantity}</p>}
                  <button onClick={() => setOpenResult(null)} className="mt-4 px-6 py-2 rounded-xl bg-purple-600 text-sm">{t('common.close', lang)}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== INVENTORY TAB ===== */}
        {tab === 'inventory' && (
          <div className="space-y-4">
            {!wallet ? (
              <div className="text-center py-12 text-gray-500">{t('inventory.empty', lang)}</div>
            ) : (
              <>
                <div className="flex gap-2">
                  {['all', 'held', 'listed'].map((f) => (
                    <button key={f} onClick={() => setInventoryFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs border transition ${inventoryFilter === f ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-white/10 bg-white/5 text-gray-400'}`}>{t(`inventory.filter.${f === 'all' ? 'all' : f}`, lang)}</button>
                  ))}
                </div>
                {inventory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">{t('inventory.empty', lang)}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {inventory.map((nft: Record<string, unknown>) => {
                      const rarity = nft.rarity as string;
                      const status = nft.status as string;
                      return (
                        <div key={nft.id as number} className={`rounded-xl border p-3 ${RARITY_BG[rarity] || 'bg-white/5'} ${RARITY_COLORS[rarity] || 'border-white/10'}`}>
                          <div className="w-full aspect-square rounded-lg overflow-hidden mb-2">
                            {images[rarity] ? <img src={images[rarity]} alt={rarity} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">?</div>}
                          </div>
                          <p className={`text-sm font-medium ${RARITY_COLORS[rarity]?.split(' ')[0] || ''}`}>{t(`rarity.${rarity}`, lang)}</p>
                          <p className="text-xs text-gray-500">#{nft.id as number}</p>
                          {status === 'held' && wallet && (
                            <div className="flex gap-1 mt-2">
                              <button onClick={() => { setSellModal(nft); setActionType('sell'); setActionError(''); }} className="flex-1 text-xs py-1 rounded bg-purple-600/80 hover:bg-purple-500">{t('inventory.sell.platform', lang)}</button>
                              <button onClick={() => { setSellModal(nft); setActionType('list'); setActionError(''); }} className="flex-1 text-xs py-1 rounded bg-blue-600/80 hover:bg-blue-500">{t('inventory.sell.market', lang)}</button>
                              <button onClick={() => { setSellModal(nft); setActionType('gift'); setActionError(''); }} className="text-xs py-1 px-2 rounded bg-white/10 hover:bg-white/20">{t('inventory.gift', lang)}</button>
                            </div>
                          )}
                          {status === 'listed' && (
                            <button onClick={() => handleCancelListing(nft.id as number)} className="mt-2 w-full text-xs py-1 rounded bg-red-600/50 hover:bg-red-500">{t('inventory.cancel.listing', lang)}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Action modal */}
            {sellModal && settings && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => { setSellModal(null); setActionType(null); }}>
                <div className="bg-[#1a1230] rounded-2xl p-5 max-w-xs mx-4 w-full" onClick={(e) => e.stopPropagation()}>
                  {actionType === 'sell' && (() => {
                    const rarity = sellModal.rarity as string;
                    const recyclePrice = parseFloat(settings[`recycle_${rarity}` as string] as string) || 0;
                    const fee = recyclePrice * parseFloat(settings.recycle_fee_rate as string) / 100;
                    const receive = recyclePrice - fee;
                    const payoutReady = !!settings.payout_wallet;
                    return (
                      <>
                        <p className="text-sm font-medium mb-3">{t('inventory.sell.platform', lang)} - {t(`rarity.${rarity}`, lang)}</p>
                        <div className="space-y-2 text-xs mb-4">
                          <div className="flex justify-between"><span className="text-gray-400">{t('inventory.sell.price', lang)}</span><span>{recyclePrice.toFixed(2)} USDT</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">{t('inventory.sell.fee', lang)}</span><span className="text-red-400">-{fee.toFixed(2)}</span></div>
                          <div className="flex justify-between font-bold"><span>{t('inventory.sell.receive', lang)}</span><span className="text-green-400">{receive.toFixed(2)} USDT</span></div>
                        </div>
                        <button onClick={() => handleSell(sellModal.id as number)} disabled={!payoutReady} className={`w-full py-2.5 rounded-xl text-sm font-medium ${payoutReady ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-600 cursor-not-allowed'}`}>{payoutReady ? t('inventory.sell.confirm', lang) : t('inventory.sell.disabled', lang)}</button>
                      </>
                    );
                  })()}
                  {actionType === 'list' && (
                    <>
                      <p className="text-sm font-medium mb-3">{t('inventory.sell.market', lang)}</p>
                      <input type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} placeholder="USDT" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-purple-500" />
                      <p className="text-xs text-gray-500 mb-3">{t('market.fee.note', lang)}</p>
                      <button onClick={() => handleList(sellModal.id as number)} className="w-full py-2.5 rounded-xl bg-blue-600 text-sm font-medium">{t('inventory.list.confirm', lang)}</button>
                    </>
                  )}
                  {actionType === 'gift' && (
                    <>
                      <p className="text-sm font-medium mb-3">{t('inventory.gift', lang)}</p>
                      <input type="text" value={giftTo} onChange={(e) => setGiftTo(e.target.value)} placeholder="0x..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:border-purple-500" />
                      <button onClick={() => handleGift(sellModal.id as number)} className="w-full py-2.5 rounded-xl bg-green-600 text-sm font-medium">{t('inventory.gift.confirm', lang)}</button>
                    </>
                  )}
                  {actionError && <p className="text-xs text-red-400 text-center mb-2">{actionError}</p>}
                  <button onClick={() => { setSellModal(null); setActionType(null); setActionError(''); }} className="w-full mt-2 py-2 text-xs text-gray-400">{t('common.cancel', lang)}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== MARKET TAB ===== */}
        {tab === 'market' && (
          <div className="space-y-3">
            {/* 平台兜底回收价展示 - 仅登录用户可见 */}
            {wallet && (
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 rounded-xl p-4 border border-purple-500/30">
              <div className="text-center mb-3">
                <span className="text-sm font-bold text-purple-300">{t('market.recycle.title', lang)}</span>
                <span className="text-xs text-gray-400 ml-2">(USDT)</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {RARITIES.map((r) => (
                  <div key={r} className="text-center">
                    <div className={`text-xs font-medium mb-1 ${r === 'fanpin' ? 'text-gray-400' : r === 'lingpin' ? 'text-blue-400' : r === 'xuanpin' ? 'text-purple-400' : r === 'xianpin' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {t(`rarity.${r}`, lang)}
                    </div>
                    <div className="text-lg font-bold text-white">
                      {settings ? Number(settings[`recycle_${r}`] as string | number || 0).toFixed(1) : '0.0'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
            <p className="text-xs text-gray-500">{t('market.fee.note', lang)}</p>
            {listings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">{t('market.empty', lang)}</div>
            ) : (
              <div className="space-y-3">
                {listings.map((item: Record<string, unknown>) => {
                  const rarity = item.rarity as string;
                  return (
                    <div key={item.id as number} className={`bg-white/5 rounded-xl p-4 border ${RARITY_COLORS[rarity] || 'border-white/10'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                          {images[rarity] ? <img src={images[rarity]} alt={rarity} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">?</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${RARITY_COLORS[rarity]?.split(' ')[0] || ''}`}>{t(`rarity.${rarity}`, lang)}</p>
                          <p className="text-lg font-bold">{parseFloat(item.price as string).toFixed(2)} USDT</p>
                          <p className="text-xs text-gray-500">{t('market.seller', lang)}: {(item.seller_wallet as string).slice(0, 6)}...{(item.seller_wallet as string).slice(-4)}</p>
                        </div>
                        {wallet && wallet !== (item.seller_wallet as string) && (
                          <button onClick={() => handleMarketBuy(item.id as number)} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium">{t('market.buy', lang)}</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== REFERRAL TAB ===== */}
        {tab === 'referral' && (
          <div className="space-y-4">
            {!wallet ? (
              <div className="text-center py-12 text-gray-500">Connect wallet to view referral info</div>
            ) : referralData ? (
              <>
                {/* Disabled notice */}
                {referralData.referral_enabled === false && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs text-yellow-400">{t('referral.disabled', lang)}</div>
                )}

                {/* Referral link */}
                {referralData.user && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">{t('referral.my.code', lang)}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-purple-300">{(referralData.user as Record<string, unknown>).referral_code as string}</code>
                      <button onClick={() => { navigator.clipboard.writeText((referralData.user as Record<string, unknown>).referral_code as string); }} className="text-xs text-purple-400">{t('referral.copy', lang)}</button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 mb-1">{t('referral.my.link', lang)}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-gray-300 truncate">{siteOrigin}/?ref={(referralData.user as Record<string, unknown>).referral_code as string}</code>
                      <button onClick={() => { navigator.clipboard.writeText(`${siteOrigin}/?ref=${(referralData.user as Record<string, unknown>).referral_code as string}`); }} className="text-xs text-purple-400 flex-shrink-0">{t('referral.copy', lang)}</button>
                    </div>
                  </div>
                )}

                {/* Commission balance */}
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">{t('referral.commission.balance', lang)}</p>
                  <p className="text-2xl font-bold text-green-400">{referralData.commission_balance as string} <span className="text-sm text-gray-400">USDT</span></p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>{t('referral.commission.total', lang)}: {referralData.total_commission as string} USDT</span>
                    <span>{t('referral.team.count', lang)}: {(referralData.team as Record<string, number>).l1 + (referralData.team as Record<string, number>).l2}</span>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs text-gray-500">
                    <span>{t('referral.level.1', lang)}: {(referralData.rates as Record<string, string>).l1}% | {t('referral.level.2', lang)}: {(referralData.rates as Record<string, string>).l2}%</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{t('referral.self.note', lang)}</p>
                </div>

                {/* Withdraw */}
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm">{t('referral.withdraw', lang)}</span>
                    <span className="text-xs text-gray-500">{t('referral.withdraw.min', lang)}: {referralData.min_withdraw as string} USDT</span>
                  </div>
                  <button onClick={handleWithdraw} disabled={parseFloat(referralData.commission_balance as string) < parseFloat(referralData.min_withdraw as string)} className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                    {t('referral.withdraw', lang)}
                  </button>
                </div>

                {/* Commission history */}
                {(referralData.commissions as Record<string, unknown>[]).length > 0 && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-2">{t('referral.history', lang)}</p>
                    <div className="space-y-2">
                      {(referralData.commissions as Record<string, unknown>[]).slice(0, 10).map((c: Record<string, unknown>, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-400">{t(`referral.level.${c.level as number}`, lang)} - {(c.from_wallet as string).slice(0, 6)}...</span>
                          <span className="text-green-400">+{c.amount as string} USDT</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">{t('common.loading', lang)}</div>
            )}
          </div>
        )}

        {/* ===== HISTORY TAB ===== */}
        {tab === 'history' && (
          <div className="space-y-3">
            {!wallet ? (
              <div className="text-center py-12 text-gray-500">{t('nav.connect', lang)}</div>
            ) : txHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">{t('history.empty', lang)}</div>
            ) : (
              txHistory.map((tx: Record<string, unknown>, i: number) => {
                const type = tx.type as string;
                const isBuyBlindbox = type === 'buy_blindbox';
                const showFee = !isBuyBlindbox && Number(tx.fee_amount || 0) > 0;
                return (
                  <div key={i} className="bg-white/5 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-purple-300">{t(`history.type.${type}`, lang)}</span>
                      <span className="text-[10px] text-gray-500">{new Date(tx.created_at as string).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="text-gray-500">{t('history.amount', lang)}</div>
                      <div className="text-right text-white">{tx.amount as string} {tx.currency as string}</div>
                      {Number(tx.quantity || 0) > 1 && (
                        <>
                          <div className="text-gray-500">{t('history.quantity', lang)}</div>
                          <div className="text-right text-white">{tx.quantity as number}</div>
                        </>
                      )}
                      {showFee && (
                        <>
                          <div className="text-gray-500">{t('history.fee', lang)}</div>
                          <div className="text-right text-red-400">-{tx.fee_amount as string} {tx.currency as string}</div>
                        </>
                      )}
                      {Number(tx.receive_amount || 0) > 0 && (
                        <>
                          <div className="text-gray-500">{t('history.receive', lang)}</div>
                          <div className="text-right text-green-400">+{tx.receive_amount as string} {tx.currency as string}</div>
                        </>
                      )}
                      <div className="text-gray-500">{t('history.status', lang)}</div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${(tx.status as string) === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{t(`history.status.${tx.status as string}`, lang)}</span>
                      </div>
                      {(tx.related_wallet as string) && (
                        <>
                          <div className="text-gray-500">{t('history.related', lang)}</div>
                          <div className="text-right text-gray-400 font-mono text-[10px]">{(tx.related_wallet as string).slice(0, 8)}...{(tx.related_wallet as string).slice(-6)}</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Footer with hidden admin link */}
      <footer className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-[8px] text-white/5 cursor-default select-none" onClick={() => window.location.href = '/admin'}>{t('footer.copyright', lang)}</p>
      </footer>
    </div>
  );
}

const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
