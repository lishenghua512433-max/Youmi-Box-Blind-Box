import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://evxfedjqfdugwqbjrmew.supabase.co";
const supabaseKey = "sb_publishable_rD4gfg85ACNOZiVdDzvkHw_1lLM9zW-";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Transactions API Error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
