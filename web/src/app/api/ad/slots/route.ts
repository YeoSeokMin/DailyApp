import { NextResponse } from 'next/server';
import { getAdSlots } from '@/lib/ads';

export async function GET() {
  try {
    const data = await getAdSlots();
    return NextResponse.json({
      success: true,
      slots: data.slots,
      lastUpdated: data.lastUpdated
    });
  } catch (error) {
    console.error('Get slots error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 캐시 무효화
export const dynamic = 'force-dynamic';
