import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');
    const status = searchParams.get('status') || 'held';

    if (!wallet) {
      return NextResponse.json([]);
    }

    const { data: inventory, error } = await supabase
      .from('nft_inventory')
      .select(`
        id, status, nft_id,
        nft_images (name, image_url, rarity)
      `)
      .eq('wallet', wallet)
      .eq('status', status);

    if (error) throw error;

    return NextResponse.json(inventory);
  } catch (err) {
    console.error('Inventory API Error:', err);
    return NextResponse.json([]);
  }
}
