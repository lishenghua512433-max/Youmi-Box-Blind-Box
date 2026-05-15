'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { i18n, type Lang } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  ArrowLeft, Save, DollarSign, Image, Users, Settings,
  BarChart3, Shield, Upload, Loader2, Globe, Coins
} from 'lucide-react';

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
  admin_password: string;
}

interface Stats {
  userCount: number; txCount: number; nftCount: number; totalVolume: string;
  recentTransactions: Array<{ id: number; wallet_address: string; type: string; amount: string; currency: string; status: string; created_at: string }>;
  recentUsers: Array<{ wallet_address: string; referral_code: string; total_spent: string; total_boxes: number; created_at: string }>;
}

const RARITY_LIST = ['normal', 'rare', 'epic', 'legend', 'myth'];
const RARITY_COLORS: Record<string, string> = {
  normal: 'text-gray-400', rare: 'text-blue-400', epic: 'text-purple-400',
  legend: 'text-amber-400', myth: 'text-red-400',
};
const RARITY_BG: Record<string, string> = {
  normal: 'bg-gray-500/20', rare: 'bg-blue-500/20', epic: 'bg-purple-500/20',
  legend: 'bg-amber-500/20', myth: 'bg-red-500/20',
};

export default function AdminPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('en');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('prices');
  const [nftImageUrls, setNftImageUrls] = useState<Record<string, string>>({});
  const [uploadingRarity, setUploadingRarity] = useState<string | null>(null);

  const t = useCallback((key: string) => i18n[lang][key] || key, [lang]);

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_logged_in');
    if (stored === 'true') {
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadSettings();
      loadStats();
      loadImages();
    }
  }, [loggedIn]);

  const loadSettings = async () => {
    try {
      const r = await fetch('/api/admin/settings');
      const d = await r.json();
      if (d.success) setSettings(d.data);
    } catch { /* ignore */ }
  };

  const loadStats = async () => {
    try {
      const r = await fetch('/api/admin/stats');
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch { /* ignore */ }
  };

  const loadImages = async () => {
    try {
      const r = await fetch('/api/admin/images');
      const d = await r.json();
      if (d.success) {
        const map: Record<string, string> = {};
        d.data.forEach((img: { rarity: string; image_url: string }) => { map[img.rarity] = img.image_url; });
        setNftImageUrls(map);
      }
    } catch { /* ignore */ }
  };

  const handleLogin = async () => {
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: 'admin', password }),
      });
      const d = await r.json();
      if (d.success) {
        setLoggedIn(true);
        sessionStorage.setItem('admin_logged_in', 'true');
      } else {
        toast.error('Invalid password');
      }
    } catch {
      toast.error('Login failed');
    }
  };

  const handleSave = async (updates: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: settings.admin_password, ...updates }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success('Settings saved!');
        loadSettings();
      } else {
        toast.error(d.error || 'Save failed');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageSave = async (rarity: string, url: string) => {
    setUploadingRarity(rarity);
    try {
      const r = await fetch('/api/admin/images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rarity, image_url: url, password: settings?.admin_password }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success('Image updated!');
        loadImages();
      } else {
        toast.error(d.error || 'Update failed');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setUploadingRarity(null);
    }
  };

  const updateField = (field: string, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const shortenAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Toaster theme="dark" />
        <Card className="w-80 border-white/10 bg-white/5">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-amber-400 mb-2" />
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            </div>
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="bg-white/5 border-white/10 text-white" />
            <Button onClick={handleLogin} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold">
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Toaster theme="dark" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <span className="font-bold text-white">Admin Panel</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="text-gray-400 hover:text-white">
            <Globe className="mr-1 h-4 w-4" />{t('lang.switch')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            {[
              { value: 'prices', icon: DollarSign, label: 'Prices' },
              { value: 'images', icon: Image, label: 'NFT Images' },
              { value: 'probability', icon: BarChart3, label: 'Probability' },
              { value: 'commission', icon: Users, label: 'Commission' },
              { value: 'contracts', icon: Settings, label: 'Contracts' },
              { value: 'fees', icon: Coins, label: 'Fees' },
              { value: 'stats', icon: BarChart3, label: 'Stats' },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 rounded-lg text-xs sm:text-sm">
                <tab.icon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />{tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* PRICES TAB */}
          <TabsContent value="prices" className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Blind Box Prices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['bnb', 'usdt', 'busd', 'usdc', 'sol', 'doge'].map((cur) => (
                  <div key={cur} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-gray-400 uppercase">{cur}</span>
                    <Input value={settings[`price_${cur}` as keyof Settings] as string}
                      onChange={(e) => updateField(`price_${cur}`, e.target.value)}
                      className="bg-white/5 border-white/10 text-white" />
                  </div>
                ))}
                <Button onClick={() => handleSave(Object.fromEntries(['bnb', 'usdt', 'busd', 'usdc', 'sol', 'doge'].map(c => [`price_${c}`, settings[`price_${c}` as keyof Settings]])))}
                  disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Prices
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Recycle Prices (BNB)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {RARITY_LIST.map((r) => (
                  <div key={r} className="flex items-center gap-3">
                    <span className={`w-20 text-sm ${RARITY_COLORS[r]} capitalize`}>{r}</span>
                    <Input value={settings[`recycle_${r}` as keyof Settings] as string}
                      onChange={(e) => updateField(`recycle_${r}`, e.target.value)}
                      className="bg-white/5 border-white/10 text-white" />
                    <span className="text-xs text-gray-500">BNB</span>
                  </div>
                ))}
                <Button onClick={() => handleSave(Object.fromEntries(RARITY_LIST.map(r => [`recycle_${r}`, settings[`recycle_${r}` as keyof Settings]])))}
                  disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Recycle Prices
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IMAGES TAB */}
          <TabsContent value="images" className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">NFT Images by Rarity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {RARITY_LIST.map((r) => (
                  <div key={r} className="flex items-center gap-4 rounded-lg bg-white/5 p-3 border border-white/10">
                    <div className={`h-16 w-16 rounded-lg ${RARITY_BG[r]} overflow-hidden border border-white/10`}>
                      <img src={nftImageUrls[r] || `/nft/${r}.svg`} alt={r} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className={`text-sm font-medium capitalize ${RARITY_COLORS[r]}`}>{r}</span>
                      <Input value={nftImageUrls[r] || ''} placeholder="Image URL"
                        onChange={(e) => setNftImageUrls({ ...nftImageUrls, [r]: e.target.value })}
                        className="bg-white/5 border-white/10 text-white text-xs h-8" />
                    </div>
                    <Button size="sm" onClick={() => handleImageSave(r, nftImageUrls[r] || '')}
                      disabled={uploadingRarity === r}
                      className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30">
                      {uploadingRarity === r ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROBABILITY TAB */}
          <TabsContent value="probability" className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Drop Probability (%)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {RARITY_LIST.map((r) => (
                  <div key={r} className="flex items-center gap-3">
                    <span className={`w-20 text-sm ${RARITY_COLORS[r]} capitalize`}>{r}</span>
                    <Input type="number" value={settings[`prob_${r}` as keyof Settings] as string}
                      onChange={(e) => updateField(`prob_${r}`, e.target.value)}
                      className="bg-white/5 border-white/10 text-white" />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                ))}
                <div className="text-xs text-gray-500">
                  Total: {RARITY_LIST.reduce((sum, r) => sum + parseFloat(settings[`prob_${r}` as keyof Settings] as string || '0'), 0).toFixed(2)}% (should be 100%)
                </div>
                <Button onClick={() => handleSave(Object.fromEntries(RARITY_LIST.map(r => [`prob_${r}`, settings[`prob_${r}` as keyof Settings]])))}
                  disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Probability
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMMISSION TAB */}
          <TabsContent value="commission" className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Commission Rates (%)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'commission_l1', label: 'Level 1 (Direct)', color: 'text-amber-400' },
                  { key: 'commission_l2', label: 'Level 2', color: 'text-blue-400' },
                  { key: 'commission_l3', label: 'Level 3', color: 'text-purple-400' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className={`w-32 text-sm ${item.color}`}>{item.label}</span>
                    <Input type="number" value={settings[item.key as keyof Settings] as string}
                      onChange={(e) => updateField(item.key, e.target.value)}
                      className="bg-white/5 border-white/10 text-white" />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                ))}
                <Button onClick={() => handleSave({
                  commission_l1: settings.commission_l1,
                  commission_l2: settings.commission_l2,
                  commission_l3: settings.commission_l3,
                })} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Commission Rates
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTRACTS TAB */}
          <TabsContent value="contracts" className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Contract & Wallet Addresses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'nft_contract_address', label: 'NFT Contract' },
                  { key: 'payment_wallet_address', label: 'Payment Wallet' },
                  { key: 'usdt_contract', label: 'USDT Contract' },
                  { key: 'busd_contract', label: 'BUSD Contract' },
                  { key: 'usdc_contract', label: 'USDC Contract' },
                  { key: 'sol_contract', label: 'SOL Contract' },
                  { key: 'doge_contract', label: 'DOGE Contract' },
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <span className="text-xs text-gray-400">{item.label}</span>
                    <Input value={settings[item.key as keyof Settings] as string}
                      onChange={(e) => updateField(item.key, e.target.value)}
                      className="bg-white/5 border-white/10 text-white font-mono text-xs" />
                  </div>
                ))}
                <Button onClick={() => handleSave({
                  nft_contract_address: settings.nft_contract_address,
                  payment_wallet_address: settings.payment_wallet_address,
                  usdt_contract: settings.usdt_contract,
                  busd_contract: settings.busd_contract,
                  usdc_contract: settings.usdc_contract,
                  sol_contract: settings.sol_contract,
                  doge_contract: settings.doge_contract,
                })} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Addresses
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Change Admin Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={settings.admin_password}
                  onChange={(e) => updateField('admin_password', e.target.value)}
                  className="bg-white/5 border-white/10 text-white" />
                <Button onClick={() => handleSave({ admin_password: settings.admin_password })}
                  disabled={saving} className="bg-red-500 hover:bg-red-600 text-white font-bold">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEES TAB */}
          <TabsContent value="fees" className="space-y-4">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Fee Rates (%)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'buy_fee_rate', label: 'Buy Blind Box Fee', desc: 'Fee charged when users purchase a blind box' },
                  { key: 'sell_fee_rate', label: 'Sell NFT Fee', desc: 'Fee deducted when users sell NFTs back' },
                  { key: 'withdraw_fee_rate', label: 'Withdraw Commission Fee', desc: 'Fee charged when users withdraw commission' },
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <span className="text-sm text-white">{item.label}</span>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={settings[item.key as keyof Settings] as string}
                        onChange={(e) => updateField(item.key, e.target.value)}
                        className="bg-white/5 border-white/10 text-white w-32" />
                      <span className="text-sm text-gray-400">%</span>
                    </div>
                  </div>
                ))}
                <Button onClick={() => handleSave({
                  buy_fee_rate: settings.buy_fee_rate,
                  sell_fee_rate: settings.sell_fee_rate,
                  withdraw_fee_rate: settings.withdraw_fee_rate,
                })} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Save Fee Rates
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Users', value: stats?.userCount || 0, color: 'text-blue-400' },
                { label: 'Transactions', value: stats?.txCount || 0, color: 'text-green-400' },
                { label: 'NFTs', value: stats?.nftCount || 0, color: 'text-purple-400' },
                { label: 'Total Volume', value: `${stats?.totalVolume || '0'} BNB`, color: 'text-amber-400' },
              ].map((item) => (
                <Card key={item.label} className="border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent Users */}
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Recent Users</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {stats?.recentUsers.map((u) => (
                      <div key={u.wallet_address} className="flex items-center justify-between rounded-lg bg-white/5 p-2 text-xs border border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300 font-mono">{shortenAddr(u.wallet_address)}</span>
                          <Badge variant="outline" className="text-xs border-white/10 text-gray-500">{u.referral_code}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-amber-400">{u.total_boxes} boxes</span>
                          <span className="text-gray-500">{new Date(u.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white text-base">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {stats?.recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg bg-white/5 p-2 text-xs border border-white/5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${tx.type === 'buy_blindbox' ? 'border-green-500/30 text-green-400' : tx.type === 'sell_nft' ? 'border-amber-500/30 text-amber-400' : 'border-blue-500/30 text-blue-400'}`}>
                            {tx.type.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-gray-400 font-mono">{shortenAddr(tx.wallet_address)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-white">{tx.amount} {tx.currency}</span>
                          <Badge className={tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Button variant="outline" onClick={loadStats} className="border-white/10 text-gray-400">
              Refresh Stats
            </Button>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
