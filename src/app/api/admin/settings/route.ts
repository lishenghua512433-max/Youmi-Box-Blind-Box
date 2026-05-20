import { NextResponse } from 'next/server';

// 直接硬编码返回完整配置，不管数据库
export async function GET() {
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

export async function POST() {
  // 模拟保存成功，让后台能正常提交
  return NextResponse.json({ success: true });
}
