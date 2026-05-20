import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 从环境变量读取Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET：读取设置
export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('key, value');

    if (error) throw error;

    const result = {};
    settings.forEach(item => {
      result[item.key] = item.value;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Settings API Error:', err);
    return NextResponse.json({}, { status: 200 });
  }
}

// POST：保存设置
export async function POST(req) {
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
