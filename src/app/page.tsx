'use client';

import { useState, useEffect, useCallback } from 'react';
import { i18n, type Lang } from '@/lib/i18n';
import { connectWallet, switchToBSC, isBSCNetwork, sendBNB, sendERC20 } from '@/lib/web3';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  Gift, Wallet, Users, Globe, Copy, ArrowRight,
  Sparkles, Shield, Coins, ChevronDown, ExternalLink,
  CheckCircle, AlertCircle, Loader2, Box, LogOut, Eye, EyeOff
} from 'lucide-react';

// Types
interface Settings {
  id: number;
  price_bnb: string; price_usdt: string; price_busd: string;
  price_usdc: string; price_sol: string; price_doge: string;
  buy_fee_rate: string; sell_fee_rate: string; withdraw_fee_rate: string;
  recycle_normal: string; recycle_rare: string; recycle_epic: string;
  recycle_legend: string; recycle_myth: string;
  prob_normal: string; prob_rare: string; prob_epic: string;
  prob_legend: string; prob_myth: string;
  commission_l1: string; commission_l2: string; commission_l3: string;
  nft_contract_address: string; payment_wallet_address: string;
  usdt_contract: string; busd_contract: string; usdc_contract: string;
  sol_contract: string; doge_contract: string;
}

interface NFTImage { rarity: string; image_url: string; }

interface NFTItem {
  id: number; wallet_address: string; rarity: string; status: string;
  purchase_price: string; purchase_currency: string; sold_price: string | null;
  created_at: string; sold_at: string | null;
}

interface UserInfo {
  wallet_address: string; referral_code: string; parent_code: string | null;
  commission_balance: string; total_commission: string;
  total_spent: string; total_boxes: number;
}

interface CommissionItem {
  id: number; from_wallet: string; level: number;
  amount: string; created_at: string;
}

const CURRENCIES = ['BNB', 'USDT', 'BUSD', 'USDC', 'SOL', 'DOGE'] as const;
type Currency = typeof CURRENCIES[number];

const RARITY_COLORS: Record<string, string> = {
  normal: 'from-gray-500 to-gray-600',
  rare: 'from-blue-500 to-blue-600',
  epic: 'from-purple-500 to-purple-600',
  legend: 'from-amber-500 to-amber-600',
  myth: 'from-red-500 to-orange-500',
};

const RARITY_BORDER: Record<string, string> = {
  normal: 'border-gray-500/50',
  rare: 'border-blue-500/50',
  epic: 'border-purple-500/50',
  legend: 'border-amber-500/50',
  myth: 'border-red-500/50',
};

const RARITY_GLOW: Record<string, string> = {
  normal: '',
  rare: 'shadow-blue-500/20 shadow-lg',
  epic: 'shadow-purple-500/20 shadow-lg',
  legend: 'shadow-amber-500/30 shadow-xl',
  myth: 'shadow-red-500/30 shadow-xl',
};

export default function HomePage() {
  // Core state
  const [lang, setLang] = useState<Lang>('en');
  const [wallet, setWallet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('blindbox');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [nftImages, setNftImages] = useState<Record<string, string>>({});

  // Blind box state
  const [currency, setCurrency] = useState<Currency>('BNB');
  const [buying, setBuying] = useState(false);
  const [revealNFT, setRevealNFT] = useState<{ rarity: string; id: number } | null>(null);
  const [showReveal, setShowReveal] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<NFTItem[]>([]);
  const [invFilter, setInvFilter] = useState('all');
  const [sellNFT, setSellNFT] = useState<NFTItem | null>(null);
  const [selling, setSelling] = useState(false);
  const [showSellDialog, setShowSellDialog] = useState(false);

  // Referral state
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [teamCounts, setTeamCounts] = useState({ l1: 0, l2: 0, l3: 0 });
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  // Admin
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState('');

  // Helper
  const t = useCallback((key: string) => i18n[lang][key] || key, [lang]);

  // Load settings
  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(r => {
      if (r.success) setSettings(r.data);
    }).catch(() => {});
    fetch('/api/admin/images').then(r => r.json()).then(r => {
      if (r.success) {
        const map: Record<string, string> = {};
        r.data.forEach((img: NFTImage) => { map[img.rarity] = img.image_url; });
        setNftImages(map);
      }
    }).catch(() => {});
  }, []);

  // Load user data when wallet changes
  useEffect(() => {
    if (!wallet) return;
    loadInventory();
    loadReferral();
  }, [wallet]);

  // Check referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      sessionStorage.setItem('ref_code', ref);
    }
    setSiteOrigin(siteOrigin);
  }, []);

  const loadInventory = async () => {
    if (!wallet) return;
    try {
      const r = await fetch(`/api/inventory?wallet=${wallet}&status=${invFilter}`);
      const d = await r.json();
      if (d.success) setInventory(d.data);
    } catch { /* ignore */ }
  };

  const loadReferral = async () => {
    if (!wallet) return;
    try {
      const r = await fetch(`/api/referral?wallet=${wallet}`);
      const d = await r.json();
      if (d.success) {
        setUserInfo(d.data.user);
        setCommissions(d.data.commissions);
        setTeamCounts(d.data.team);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { loadInventory(); }, [invFilter, wallet]);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setWallet(addr);
      toast.success(lang === 'zh' ? '钱包已连接' : 'Wallet connected');
    } else {
      toast.error(lang === 'zh' ? '请安装钱包插件' : 'Please install a wallet');
    }
  };

  const handleDisconnect = () => {
    setWallet(null);
    setUserInfo(null);
    setInventory([]);
  };

  const handleSwitchNetwork = async () => {
    const ok = await switchToBSC();
    if (ok) toast.success(t('common.switch.network'));
  };

  const getPrice = (cur: Currency): string => {
    if (!settings) return '0';
    const key = `price_${cur.toLowerCase()}` as keyof Settings;
    return settings[key] as string;
  };

  const getRecyclePrice = (rarity: string): string => {
    if (!settings) return '0';
    const key = `recycle_${rarity}` as keyof Settings;
    return settings[key] as string;
  };

  const handleBuy = async () => {
    if (!wallet || !settings) return;
    setBuying(true);
    try {
      const onBSC = await isBSCNetwork();
      if (!onBSC) {
        await switchToBSC();
      }

      let txHash: string | null = null;
      const price = getPrice(currency);
      const toAddr = settings.payment_wallet_address;

      if (toAddr) {
        if (currency === 'BNB') {
          txHash = await sendBNB(toAddr, price);
        } else {
          const contractKey = `${currency.toLowerCase()}_contract` as keyof Settings;
          const contractAddr = settings[contractKey] as string;
          if (contractAddr) {
            txHash = await sendERC20(contractAddr, toAddr, price);
          }
        }
      }

      const refCode = sessionStorage.getItem('ref_code') || undefined;
      const r = await fetch('/api/blindbox/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, currency, tx_hash: txHash, ref_code: refCode }),
      });
      const d = await r.json();

      if (d.success) {
        setRevealNFT({ rarity: d.data.rarity, id: d.data.nft_id });
        setShowReveal(true);
        toast.success(t('blindbox.success'));
        loadInventory();
        loadReferral();
      } else {
        toast.error(d.error || t('blindbox.error'));
      }
    } catch {
      toast.error(t('blindbox.error'));
    } finally {
      setBuying(false);
    }
  };

  const handleSell = async () => {
    if (!sellNFT || !wallet) return;
    setSelling(true);
    try {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nft_id: sellNFT.id, wallet }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(t('inventory.sell.success'));
        setShowSellDialog(false);
        setSellNFT(null);
        loadInventory();
        loadReferral();
      } else {
        toast.error(d.error || t('inventory.sell.error'));
      }
    } catch {
      toast.error(t('inventory.sell.error'));
    } finally {
      setSelling(false);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet) return;
    setWithdrawing(true);
    try {
      const r = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(t('referral.withdraw.success'));
        setShowWithdrawDialog(false);
        loadReferral();
      } else {
        toast.error(d.error || t('referral.withdraw.error'));
      }
    } catch {
      toast.error(t('referral.withdraw.error'));
    } finally {
      setWithdrawing(false);
    }
  };

  const handleAdminLogin = async () => {
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: 'admin', password: adminPass }),
      });
      const d = await r.json();
      if (d.success) {
        setAdminLoggedIn(true);
        setShowAdminLogin(false);
        window.location.href = '/admin';
      } else {
        toast.error('Invalid credentials');
      }
    } catch {
      toast.error('Login failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('referral.copied'));
  };

  const shortenAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <Toaster theme="dark" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-amber-400" />
            <span className="text-lg font-bold text-white">{t('app.title')}</span>
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">BSC</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="text-gray-400 hover:text-white">
              <Globe className="mr-1 h-4 w-4" />
              {t('lang.switch')}
            </Button>
            {wallet ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  {shortenAddr(wallet)}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-gray-500 hover:text-red-400">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleConnect} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                <Wallet className="mr-1 h-4 w-4" />
                {t('nav.connect')}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {!wallet ? (
          /* Not Connected - Landing */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 p-6 border border-amber-500/20">
              <Box className="h-16 w-16 text-amber-400 animate-bounce" />
            </div>
            <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl tracking-tight">{t('app.title')}</h1>
            <p className="mb-8 text-base text-gray-400 max-w-md leading-relaxed">{t('app.subtitle')}</p>
            <Button size="lg" onClick={handleConnect} className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 py-6 rounded-xl">
              <Wallet className="mr-2 h-5 w-5" />
              {t('nav.connect')}
            </Button>
          </div>
        ) : (
          /* Connected - Tabs */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-3 bg-white/5 border border-white/10 rounded-xl">
              <TabsTrigger value="blindbox" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 rounded-lg">
                <Gift className="mr-1 h-4 w-4" />{t('nav.blindbox')}
              </TabsTrigger>
              <TabsTrigger value="inventory" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 rounded-lg">
                <Box className="mr-1 h-4 w-4" />{t('nav.inventory')}
              </TabsTrigger>
              <TabsTrigger value="referral" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 rounded-lg">
                <Users className="mr-1 h-4 w-4" />{t('nav.referral')}
              </TabsTrigger>
            </TabsList>

            {/* BLIND BOX TAB */}
            <TabsContent value="blindbox" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Box Preview */}
                <Card className="border-white/10 bg-white/5 backdrop-blur overflow-hidden">
                  <CardContent className="flex flex-col items-center justify-center p-8">
                    <div className="relative mb-6">
                      <div className="h-48 w-48 rounded-2xl bg-gradient-to-br from-amber-500/30 to-purple-500/30 flex items-center justify-center border border-amber-500/30 animate-pulse">
                        <Gift className="h-24 w-24 text-amber-400" />
                      </div>
                      <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-xs">?</div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{t('blindbox.title')}</h2>
                    <p className="text-gray-400 text-center text-sm">{t('blindbox.desc')}</p>
                  </CardContent>
                </Card>

                {/* Buy Panel */}
                <Card className="border-white/10 bg-white/5 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Coins className="h-5 w-5 text-amber-400" />
                      {t('blindbox.select.currency')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10">
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c} className="text-white focus:bg-white/10 focus:text-white">
                            <span className="flex items-center gap-2">
                              {c === 'BNB' ? '💎' : c === 'USDT' ? '💲' : c === 'BUSD' ? '💲' : c === 'USDC' ? '💲' : c === 'SOL' ? '◎' : '🐕'}
                              {t(`common.${c.toLowerCase()}`)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-2 rounded-lg bg-white/5 p-3 border border-white/10">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('blindbox.price')}</span>
                        <span className="text-white font-medium">{getPrice(currency)} {currency}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('blindbox.fee')}</span>
                        <span className="text-amber-400">{settings?.buy_fee_rate || '5'}%</span>
                      </div>
                      <Separator className="bg-white/10" />
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-gray-300">{t('blindbox.total')}</span>
                        <span className="text-amber-400">
                          {(parseFloat(getPrice(currency)) * (1 + parseFloat(settings?.buy_fee_rate || '5') / 100)).toFixed(6)} {currency}
                        </span>
                      </div>
                    </div>

                    {/* Probability Preview */}
                    <div className="space-y-1">
                      <span className="text-xs text-gray-500">{lang === 'zh' ? '爆出概率' : 'Drop Rate'}</span>
                      {['normal', 'rare', 'epic', 'legend', 'myth'].map((r) => (
                        <div key={r} className="flex items-center gap-2 text-xs">
                          <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${RARITY_COLORS[r]}`} />
                          <span className="text-gray-400 flex-1">{t(`blindbox.rarity.${r}`)}</span>
                          <span className="text-gray-300">{settings?.[`prob_${r}` as keyof Settings] || '0'}%</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={handleBuy}
                      disabled={buying}
                      className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-lg py-6 rounded-xl"
                    >
                      {buying ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('blindbox.buying')}</>
                      ) : (
                        <><Gift className="mr-2 h-5 w-5" />{t('blindbox.buy')}</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Rarity Showcase */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {['normal', 'rare', 'epic', 'legend', 'myth'].map((r) => (
                  <div key={r} className={`rounded-xl border ${RARITY_BORDER[r]} bg-white/5 p-3 text-center ${RARITY_GLOW[r]} transition-all hover:scale-105`}>
                    <div className="mx-auto mb-2 h-16 w-16 rounded-lg bg-gradient-to-br overflow-hidden">
                      <img src={nftImages[r] || `/nft/${r}.svg`} alt={r} className="h-full w-full object-cover" />
                    </div>
                    <p className="text-sm font-semibold text-white">{t(`blindbox.rarity.${r}`)}</p>
                    <p className="text-xs text-gray-400">{t(`rarity.${r}.desc`)}</p>
                    <p className="text-xs text-amber-400 mt-1">{lang === 'zh' ? '回收' : 'Recycle'}: {getRecyclePrice(r)} BNB</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* INVENTORY TAB */}
            <TabsContent value="inventory" className="space-y-4">
              <div className="flex gap-2 mb-4">
                {['all', 'held', 'sold'].map((f) => (
                  <Button key={f} size="sm" variant={invFilter === f ? 'default' : 'outline'}
                    onClick={() => setInvFilter(f)}
                    className={invFilter === f ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'border-white/10 text-gray-400'}
                  >
                    {t(`inventory.filter.${f}`)}
                  </Button>
                ))}
              </div>

              {inventory.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-gray-500">
                  <Box className="h-16 w-16 mb-4 opacity-30" />
                  <p>{t('inventory.empty')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {inventory.map((nft) => (
                    <Card key={nft.id} className={`border ${RARITY_BORDER[nft.rarity]} bg-white/5 overflow-hidden ${RARITY_GLOW[nft.rarity]}`}>
                      <div className="relative">
                        <img src={nftImages[nft.rarity] || `/nft/${nft.rarity}.svg`} alt={nft.rarity} className="h-36 w-full object-cover" />
                        <Badge className={`absolute top-2 right-2 bg-gradient-to-r ${RARITY_COLORS[nft.rarity]} text-white text-xs`}>
                          {t(`blindbox.rarity.${nft.rarity}`)}
                        </Badge>
                        {nft.status === 'sold' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Badge variant="outline" className="border-red-500 text-red-400">{t('inventory.status.sold')}</Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400"># {nft.id}</span>
                          <span className="text-gray-400">{nft.purchase_currency}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">{t('inventory.sell.price')}</span>
                          <span className="text-amber-400">{getRecyclePrice(nft.rarity)} BNB</span>
                        </div>
                        {nft.status === 'held' && (
                          <Button
                            size="sm"
                            className="w-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                            onClick={() => { setSellNFT(nft); setShowSellDialog(true); }}
                          >
                            {t('inventory.sell')}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* REFERRAL TAB */}
            <TabsContent value="referral" className="space-y-6">
              {/* Commission Balance */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-400">{t('referral.commission.balance')}</p>
                    <p className="text-2xl font-bold text-amber-400">{userInfo?.commission_balance || '0'} BNB</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-400">{t('referral.commission.total')}</p>
                    <p className="text-2xl font-bold text-green-400">{userInfo?.total_commission || '0'} BNB</p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-400">{t('referral.team.count')}</p>
                    <p className="text-2xl font-bold text-blue-400">{teamCounts.l1 + teamCounts.l2 + teamCounts.l3}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Referral Link */}
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-400" />
                    {t('referral.my.link')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={`${siteOrigin}?ref=${userInfo?.referral_code || ''}`}
                      className="bg-white/5 border-white/10 text-white text-sm" />
                    <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-400"
                      onClick={() => copyToClipboard(`${siteOrigin}?ref=${userInfo?.referral_code || ''}`)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">{t('referral.my.code')}:</span>
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-mono">{userInfo?.referral_code || '---'}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Commission Rates */}
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-base">{lang === 'zh' ? '佣金比例' : 'Commission Rates'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { level: 1, rate: settings?.commission_l1 || '10', count: teamCounts.l1 },
                      { level: 2, rate: settings?.commission_l2 || '5', count: teamCounts.l2 },
                      { level: 3, rate: settings?.commission_l3 || '2', count: teamCounts.l3 },
                    ].map((item) => (
                      <div key={item.level} className="rounded-lg bg-white/5 p-3 text-center border border-white/10">
                        <p className="text-xs text-gray-400">{t(`referral.level.${item.level}`)}</p>
                        <p className="text-lg font-bold text-amber-400">{item.rate}%</p>
                        <p className="text-xs text-gray-500">{item.count} {lang === 'zh' ? '人' : 'members'}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Withdraw Button */}
              <Button
                onClick={() => setShowWithdrawDialog(true)}
                disabled={!userInfo || parseFloat(userInfo.commission_balance) <= 0}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-5 rounded-xl"
              >
                <Coins className="mr-2 h-5 w-5" />
                {t('referral.withdraw')} ({userInfo?.commission_balance || '0'} BNB)
              </Button>

              {/* Commission History */}
              {commissions.length > 0 && (
                <Card className="border-white/10 bg-white/5">
                  <CardHeader>
                    <CardTitle className="text-white text-base">{t('referral.history')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {commissions.map((c) => (
                          <div key={c.id} className="flex items-center justify-between rounded-lg bg-white/5 p-2 text-sm border border-white/5">
                            <div>
                              <span className="text-gray-400">L{c.level}</span>
                              <span className="ml-2 text-gray-500">{shortenAddr(c.from_wallet)}</span>
                            </div>
                            <span className="text-amber-400 font-medium">+{c.amount} BNB</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Footer with hidden admin entry */}
      <footer className="border-t border-white/5 mt-12">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between">
          <p className="text-xs text-gray-600">{t('footer.copyright')}</p>
          <button
            onClick={() => setShowAdminLogin(true)}
            className="text-[8px] text-gray-800 hover:text-gray-600 transition-colors select-none cursor-default"
            style={{ fontSize: '1px', opacity: 0.1 }}
          >
            admin
          </button>
        </div>
      </footer>

      {/* REVEAL DIALOG */}
      <Dialog open={showReveal} onOpenChange={setShowReveal}>
        <DialogContent className="bg-gray-900 border-amber-500/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-amber-400 text-xl">{t('blindbox.result')}</DialogTitle>
            <DialogDescription className="sr-only">NFT Reveal</DialogDescription>
          </DialogHeader>
          {revealNFT && (
            <div className="flex flex-col items-center py-6">
              <div className={`h-40 w-40 rounded-2xl overflow-hidden border-2 ${RARITY_BORDER[revealNFT.rarity]} ${RARITY_GLOW[revealNFT.rarity]} mb-4`}>
                <img src={nftImages[revealNFT.rarity] || `/nft/${revealNFT.rarity}.svg`} alt={revealNFT.rarity} className="h-full w-full object-cover" />
              </div>
              <Badge className={`bg-gradient-to-r ${RARITY_COLORS[revealNFT.rarity]} text-white text-lg px-4 py-1 mb-2`}>
                {t(`blindbox.rarity.${revealNFT.rarity}`)}
              </Badge>
              <p className="text-sm text-gray-400">{t(`rarity.${revealNFT.rarity}.desc`)}</p>
              <p className="text-xs text-gray-500 mt-2">#{revealNFT.id}</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowReveal(false)} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold">
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SELL DIALOG */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent className="bg-gray-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">{t('inventory.sell')}</DialogTitle>
            <DialogDescription className="sr-only">Sell NFT</DialogDescription>
          </DialogHeader>
          {sellNFT && settings && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 border border-white/10">
                <img src={nftImages[sellNFT.rarity] || `/nft/${sellNFT.rarity}.svg`} alt={sellNFT.rarity} className="h-12 w-12 rounded-lg object-cover" />
                <div>
                  <p className="text-white font-medium">{t(`blindbox.rarity.${sellNFT.rarity}`)} #{sellNFT.id}</p>
                  <p className="text-xs text-gray-400">{t(`rarity.${sellNFT.rarity}.desc`)}</p>
                </div>
              </div>
              <div className="space-y-2 rounded-lg bg-white/5 p-3 border border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('inventory.sell.price')}</span>
                  <span className="text-white">{getRecyclePrice(sellNFT.rarity)} BNB</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('inventory.sell.fee')}</span>
                  <span className="text-red-400">-{(parseFloat(getRecyclePrice(sellNFT.rarity)) * parseFloat(settings.sell_fee_rate) / 100).toFixed(6)} BNB ({settings.sell_fee_rate}%)</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-300">{t('inventory.sell.receive')}</span>
                  <span className="text-green-400">{(parseFloat(getRecyclePrice(sellNFT.rarity)) * (1 - parseFloat(settings.sell_fee_rate) / 100)).toFixed(6)} BNB</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSellDialog(false)} className="border-white/10 text-gray-400">{t('common.cancel')}</Button>
            <Button onClick={handleSell} disabled={selling} className="bg-green-500 hover:bg-green-600 text-white font-bold">
              {selling ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
              {t('inventory.sell.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WITHDRAW DIALOG */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="bg-gray-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">{t('referral.withdraw')}</DialogTitle>
            <DialogDescription className="sr-only">Withdraw commission</DialogDescription>
          </DialogHeader>
          {userInfo && settings && (
            <div className="space-y-3 rounded-lg bg-white/5 p-3 border border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{lang === 'zh' ? '佣金余额' : 'Balance'}</span>
                <span className="text-white">{userInfo.commission_balance} BNB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{t('referral.withdraw.fee')}</span>
                <span className="text-red-400">-{(parseFloat(userInfo.commission_balance) * parseFloat(settings.withdraw_fee_rate) / 100).toFixed(6)} BNB ({settings.withdraw_fee_rate}%)</span>
              </div>
              <Separator className="bg-white/10" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-300">{t('referral.withdraw.receive')}</span>
                <span className="text-green-400">{(parseFloat(userInfo.commission_balance) * (1 - parseFloat(settings.withdraw_fee_rate) / 100)).toFixed(6)} BNB</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)} className="border-white/10 text-gray-400">{t('common.cancel')}</Button>
            <Button onClick={handleWithdraw} disabled={withdrawing} className="bg-green-500 hover:bg-green-600 text-white font-bold">
              {withdrawing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Coins className="mr-1 h-4 w-4" />}
              {t('referral.withdraw.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADMIN LOGIN DIALOG */}
      <Dialog open={showAdminLogin} onOpenChange={setShowAdminLogin}>
        <DialogContent className="bg-gray-900 border-white/10 max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-white">Admin</DialogTitle>
            <DialogDescription className="sr-only">Admin login</DialogDescription>
          </DialogHeader>
          <Input type="password" placeholder="Password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            className="bg-white/5 border-white/10 text-white" />
          <DialogFooter>
            <Button onClick={handleAdminLogin} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold">
              <Shield className="mr-1 h-4 w-4" />Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
