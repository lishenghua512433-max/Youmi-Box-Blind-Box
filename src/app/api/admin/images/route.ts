import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const RARITIES = ['fanpin', 'lingpin', 'xuanpin', 'xianpin', 'shenpin'] as const;

export async function GET() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('nft_images').select('*').order('id');
    if (error) {
      console.warn('[admin/images] Database query error, returning empty:', error.message);
      return NextResponse.json({ success: true, data: [] });
    }
    // Ensure all rarities exist
    const existing = new Set((data || []).map((img: { rarity: string }) => img.rarity));
    for (const r of RARITIES) {
      if (!existing.has(r)) {
        const { error: insertErr } = await client.from('nft_images').insert({ rarity: r, image_url: `/nft/${r}.svg` });
        if (insertErr) {
          console.warn(`[admin/images] Could not insert ${r}:`, insertErr.message);
        }
      }
    }
    const { data: allImages, error: err2 } = await client.from('nft_images').select('*').order('id');
    if (err2) {
      console.warn('[admin/images] Re-query error, returning empty:', err2.message);
      return NextResponse.json({ success: true, data: [] });
    }
    return NextResponse.json({ success: true, data: allImages || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[admin/images] GET failed, returning empty:', message);
    return NextResponse.json({ success: true, data: [] });
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
      if (error) {
        console.warn('[admin/images] PUT upsert error for', img.rarity, ':', error.message);
        return NextResponse.json({ success: false, error: `Database error: ${error.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
