import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://evxfedjqfdugwqbjrmew.supabase.co";
const supabaseKey = "sb_publishable_rD4gfg85ACNOZiVdDzvkHw_1lLM9zW-";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase.from('market_listings').select('*');
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json([], { status: 200 });
  }
}
