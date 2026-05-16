import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const RARITIES = ['fanpin', 'lingpin', 'xuanpin', 'xianpin', 'shenpin'] as const;

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('nft_images').select('*').order('id');
    if (error) throw new Error(error.message);
    // Ensure all rarities exist
    const existing = new Set((data || []).map((img: { rarity: string }) => img.rarity));
    for (const r of RARITIES) {
      if (!existing.has(r)) {
        await client.from('nft_images').insert({ rarity: r, image_url: `/nft/${r}.svg` });
      }
    }
    const { data: allImages } = await client.from('nft_images').select('*').order('id');
    return NextResponse.json({ success: true, data: allImages || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { images } = await request.json() as { images: { rarity: string; image_url: string }[] };
    const client = getSupabaseClient();

    for (const img of images) {
      const { error } = await client.from('nft_images').upsert(
        { rarity: img.rarity, image_url: img.image_url },
        { onConflict: 'rarity' }
      );
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
