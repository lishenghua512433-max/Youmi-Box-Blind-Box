import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://evxfedjqfdugwqbjrmew.supabase.co";
const supabaseKey = "sb_publishable_rD4gfg85ACNOZiVdDzvkHw_1lLM9zW-";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data: images, error } = await supabase
      .from('nft_images')
      .select('*');

    if (error) throw error;

    return NextResponse.json(images);
  } catch (err) {
    console.error('Images API Error:', err);
    // 读取失败，返回空数组，不影响页面
    return NextResponse.json([], { status: 200 });
  }
}
