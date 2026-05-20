'use client';
import { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  if (loading) return <div className="text-white text-center p-10">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10">
      <h1 className="text-3xl font-bold text-center mb-8">Admin Panel</h1>
      <div className="max-w-2xl mx-auto bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl mb-4">定价设置</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2">盲盒价格</label>
            <input
              type="number"
              defaultValue={settings?.price || 3}
              className="w-full bg-gray-700 rounded px-3 py-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
