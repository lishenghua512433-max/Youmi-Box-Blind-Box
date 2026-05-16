'use client';

import { useState, useEffect, useCallback } from 'react';

const RARITIES = [
  { key: 'fanpin', label: '凡品 / Fanpin' },
  { key: 'lingpin', label: '灵品 / Lingpin' },
  { key: 'xuanpin', label: '玄品 / Xuanpin' },
  { key: 'xianpin', label: '仙品 / Xianpin' },
  { key: 'shenpin', label: '神品 / Shenpin' },
];

interface Settings {
  [key: string]: string | number | boolean;
}

interface ImageItem {
  rarity: string;
  image_url: string;
}

interface Stats {
  userCount: number;
  txCount: number;
  nftCount: number;
  totalVolume: string;
  recentTransactions: Record<string, unknown>[];
  recentUsers: Record<string, unknown>[];
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState('pricing');

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') setAuthed(true);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/admin/settings');
    const json = await res.json();
    if (json.success) {
      // Convert nulls to empty strings for type safety
      const data = json.data;
      for (const key of Object.keys(data)) {
        if (data[key] === null || data[key] === undefined) data[key] = '';
      }
      setSettings(data);
    }
  }, []);

  const loadImages = useCallback(async () => {
    const res = await fetch('/api/admin/images');
    const json = await res.json();
    if (json.success) setImages(json.data);
  }, []);

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats');
    const json = await res.json();
    if (json.success) setStats(json.data);
  }, []);

  useEffect(() => {
    if (authed) { loadSettings(); loadImages(); loadStats(); }
  }, [authed, loadSettings, loadImages, loadStats]);

  const handleLogin = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: 'admin', password }),
    });
    const json = await res.json();
    if (json.success) {
      sessionStorage.setItem('admin_auth', 'true');
      setAuthed(true);
    } else {
      alert('Login failed');
    }
  };

  const handleSave = async (fields: Record<string, string | number | boolean>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const json = await res.json();
      if (json.success) { await loadSettings(); alert('Saved!'); }
      else alert('Save failed: ' + json.error);
    } catch { alert('Save error'); }
    setSaving(false);
  };

  const handleImageUpload = async (rarity: string, file: File) => {
    const formData = new FormData();
    formData.append('rarity', rarity);
    formData.append('image', file);
    const res = await fetch('/api/admin/images', {
      method: 'PUT',
      body: formData,
    });
    const json = await res.json();
    if (json.success) loadImages();
    else alert('Upload failed: ' + json.error);
  };

  const updateField = (key: string, value: string) => {
    if (settings) setSettings({ ...settings, [key]: value });
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0f0b1e] flex items-center justify-center">
        <div className="bg-[#1a1230] rounded-2xl p-6 w-80 space-y-4">
          <h2 className="text-lg font-bold text-center">Admin Panel</h2>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
          <button onClick={handleLogin} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium">Login</button>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'pricing', label: 'Pricing' },
    { id: 'probabilities', label: 'Probabilities' },
    { id: 'recycle', label: 'Recycle Prices' },
    { id: 'fees', label: 'Fee Rates' },
    { id: 'commission', label: 'Commission' },
    { id: 'contracts', label: 'Contracts' },
    { id: 'images', label: 'NFT Images' },
    { id: 'stats', label: 'Statistics' },
  ];

  return (
    <div className="min-h-screen bg-[#0f0b1e] text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <button onClick={() => { sessionStorage.removeItem('admin_auth'); setAuthed(false); }} className="text-xs text-gray-400 hover:text-white">Logout</button>
        </div>

        {/* Section nav */}
        <div className="flex gap-2 flex-wrap mb-6">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)} className={`px-3 py-1.5 rounded-lg text-xs border transition ${section === s.id ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`}>{s.label}</button>
          ))}
        </div>

        {settings && (
          <div className="space-y-4">
            {/* PRICING */}
            {section === 'pricing' && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Blind Box Price</h3>
                <div>
                  <label className="text-xs text-gray-400">Price (USDT)</label>
                  <input type="number" step="0.01" value={settings.price_usdt as string} onChange={(e) => updateField('price_usdt', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <button onClick={() => handleSave({ price_usdt: settings.price_usdt })} disabled={saving} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            )}

            {/* PROBABILITIES */}
            {section === 'probabilities' && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Open Probabilities</h3>
                {RARITIES.map((r) => (
                  <div key={r.key}>
                    <label className="text-xs text-gray-400">{r.label} %</label>
                    <input type="number" step="0.1" value={settings[`prob_${r.key}`] as string} onChange={(e) => updateField(`prob_${r.key}`, e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                  </div>
                ))}
                <div className="text-xs text-gray-500">Total: {RARITIES.reduce((sum, r) => sum + parseFloat((settings[`prob_${r.key}`] as string) || '0'), 0).toFixed(1)}%</div>
                <button onClick={() => handleSave(Object.fromEntries(RARITIES.map((r) => [`prob_${r.key}`, settings[`prob_${r.key}`]])))} disabled={saving} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            )}

            {/* RECYCLE PRICES */}
            {section === 'recycle' && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Recycle Prices (USDT)</h3>
                {RARITIES.map((r) => (
                  <div key={r.key}>
                    <label className="text-xs text-gray-400">{r.label}</label>
                    <input type="number" step="0.01" value={settings[`recycle_${r.key}`] as string} onChange={(e) => updateField(`recycle_${r.key}`, e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                  </div>
                ))}
                <button onClick={() => handleSave(Object.fromEntries(RARITIES.map((r) => [`recycle_${r.key}`, settings[`recycle_${r.key}`]])))} disabled={saving} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            )}

            {/* FEE RATES */}
            {section === 'fees' && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Fee Rates (%)</h3>
                <div>
                  <label className="text-xs text-gray-400">Trade Fee (Buyer & Seller)</label>
                  <input type="number" step="0.1" value={settings.trade_fee_rate as string} onChange={(e) => updateField('trade_fee_rate', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Recycle Fee</label>
                  <input type="number" step="0.1" value={settings.recycle_fee_rate as string} onChange={(e) => updateField('recycle_fee_rate', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Withdraw Fee</label>
                  <input type="number" step="0.1" value={settings.withdraw_fee_rate as string} onChange={(e) => updateField('withdraw_fee_rate', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <button onClick={() => handleSave({ trade_fee_rate: settings.trade_fee_rate, recycle_fee_rate: settings.recycle_fee_rate, withdraw_fee_rate: settings.withdraw_fee_rate })} disabled={saving} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            )}

            {/* COMMISSION */}
            {section === 'commission' && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Commission Settings</h3>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400">Referral Enabled</label>
                  <button onClick={() => updateField('referral_enabled', String(settings.referral_enabled !== true))} className={`px-3 py-1 rounded-lg text-xs ${settings.referral_enabled ? 'bg-green-600' : 'bg-red-600'}`}>{settings.referral_enabled ? 'ON' : 'OFF'}</button>
                </div>
                <div>
                  <label className="text-xs text-gray-400">L1 Direct Commission %</label>
                  <input type="number" step="0.1" value={settings.commission_l1 as string} onChange={(e) => updateField('commission_l1', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">L2 Indirect Commission %</label>
                  <input type="number" step="0.1" value={settings.commission_l2 as string} onChange={(e) => updateField('commission_l2', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Min Withdraw (USDT)</label>
                  <input type="number" step="0.1" value={settings.min_withdraw as string} onChange={(e) => updateField('min_withdraw', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <button onClick={() => handleSave({ commission_l1: settings.commission_l1, commission_l2: settings.commission_l2, referral_enabled: settings.referral_enabled, min_withdraw: settings.min_withdraw })} disabled={saving} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            )}

            {/* CONTRACTS & WALLETS */}
            {section === 'contracts' && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Contracts & Wallets</h3>
                <div>
                  <label className="text-xs text-gray-400">Collection Wallet (receive payments)</label>
                  <input type="text" value={settings.collection_wallet as string} onChange={(e) => updateField('collection_wallet', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 font-mono focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Payout Wallet (send USDT for recycle/withdraw)</label>
                  <input type="text" value={settings.payout_wallet as string} onChange={(e) => updateField('payout_wallet', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 font-mono focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">NFT Contract Address</label>
                  <input type="text" value={settings.nft_contract_address as string} onChange={(e) => updateField('nft_contract_address', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 font-mono focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">USDT Contract</label>
                  <input type="text" value={settings.usdt_contract as string} onChange={(e) => updateField('usdt_contract', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 font-mono focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">BUSD Contract</label>
                  <input type="text" value={settings.busd_contract as string} onChange={(e) => updateField('busd_contract', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 font-mono focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">TRX Contract (BEP20)</label>
                  <input type="text" value={settings.trx_contract as string} onChange={(e) => updateField('trx_contract', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 font-mono focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Admin Password</label>
                  <input type="text" value={settings.admin_password as string} onChange={(e) => updateField('admin_password', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:border-purple-500" />
                </div>
                <button onClick={() => handleSave({ collection_wallet: settings.collection_wallet, payout_wallet: settings.payout_wallet, nft_contract_address: settings.nft_contract_address, usdt_contract: settings.usdt_contract, busd_contract: settings.busd_contract, trx_contract: settings.trx_contract, admin_password: settings.admin_password })} disabled={saving} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            )}

            {/* NFT IMAGES */}
            {section === 'images' && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">NFT Images</h3>
                {RARITIES.map((r) => {
                  const img = images.find((i) => i.rarity === r.key);
                  return (
                    <div key={r.key} className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                        {img?.image_url ? <img src={img.image_url} alt={r.key} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">?</div>}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">{r.label}</p>
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(r.key, f); }} className="text-xs" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STATISTICS */}
            {section === 'stats' && stats && (
              <div className="bg-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-medium text-purple-300">Statistics</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{stats.userCount}</p>
                    <p className="text-xs text-gray-400">Users</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{stats.nftCount}</p>
                    <p className="text-xs text-gray-400">NFTs</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{stats.txCount}</p>
                    <p className="text-xs text-gray-400">Transactions</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold">{stats.totalVolume}</p>
                    <p className="text-xs text-gray-400">Volume (USDT)</p>
                  </div>
                </div>
                {stats.recentUsers.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Recent Users</p>
                    <div className="space-y-1">
                      {stats.recentUsers.map((u: Record<string, unknown>, i: number) => (
                        <div key={i} className="flex justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                          <span className="font-mono">{(u.wallet_address as string).slice(0, 8)}...{(u.wallet_address as string).slice(-4)}</span>
                          <span className="text-gray-500">{new Date(u.created_at as string).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
