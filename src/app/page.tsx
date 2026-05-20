'use client';
import { useState, useEffect } from 'react';

export default function Home() {
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
      <h1 className="text-3xl font-bold text-center mb-8">Youmi Box Blind Box</h1>
      <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6">
        <p className="mb-4">盲盒价格: {settings?.price || 3} USDT</p>
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg">
          开启盲盒
        </button>
      </div>
    </div>
  );
}
