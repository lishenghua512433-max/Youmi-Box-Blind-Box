import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({
    totalBoxesOpened: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalNFTs: 0,
    recentTransactions: []
  });
}
