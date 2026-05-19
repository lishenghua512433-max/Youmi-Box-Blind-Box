import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const RARITIES = ['fanpin', 'lingpin', 'xuanpin', 'xianpin', 'shenpin'] as const;

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('nft_images').select('*').order('id');
    if (error) {
      console.error('[admin/images] Supabase query error:', error.message);
      throw new Error(`Database error: ${error.message}`);
    }
    // Ensure all rarities exist
    const existing = new Set((data || []).map((img: { rarity: string }) => img.rarity));
    for (const r of RARITIES) {
      if (!existing.has(r)) {
        await client.from('nft_images').insert({ rarity: r, image_url: `/nft/${r}.svg` });
      }
    }
    const { data: allImages, error: err2 } = await client.from('nft_images').select('*').order('id');
    if (err2) {
      console.error('[admin/images] Supabase re-query error:', err2.message);
      throw new Error(`Database error: ${err2.message}`);
    }
    if (!allImages || allImages.length === 0) {
      console.warn('[admin/images] nft_images table is empty after insert attempt');
    }
    return NextResponse.json({ success: true, data: allImages || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin/images] GET failed:', message);
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
