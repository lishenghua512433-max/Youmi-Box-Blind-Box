import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://evxfedjqfdugwqbjrmew.supabase.co";
const supabaseKey = "sb_publishable_rD4gfg85ACNOZiVdDzvkHw_1lLM9zW-";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('key, value');

    if (error) throw error;

    const result: Record<string, any> = {};
    settings?.forEach((item) => {
      result[item.key] = item.value;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Settings API Error:', err);
    return NextResponse.json({
      price: 3,
      common_rate: 60,
      rare_rate: 25,
      epic_rate: 10,
      legendary_rate: 4,
      mythic_rate: 1,
      recycle_common: 1,
      recycle_rare: 3,
      recycle_epic: 5,
      recycle_legendary: 20,
      recycle_mythic: 100,
      trade_fee_rate: 5,
      withdraw_fee_rate: 5,
      recycle_fee_rate: 5
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updates = [];

    for (const key in body) {
      updates.push(
        supabase
          .from('admin_settings')
          .upsert({ key, value: body[key] })
      );
    }

    await Promise.all(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Save Settings Error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
