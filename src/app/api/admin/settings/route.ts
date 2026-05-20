import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 从环境变量读取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// 定义类型
type SettingsKey = string;
type SettingsValue = any;

// GET：读取后台设置
export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('key, value');

    if (error) throw error;

    const result: Record<SettingsKey, SettingsValue> = {};
    settings?.forEach((item) => {
      result[item.key] = item.value;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Settings API Error:', err);
    return NextResponse.json({}, { status: 200 });
  }
}

// POST：保存后台设置
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
