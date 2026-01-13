import { NextResponse } from 'next/server';
import { getAdSlots, resetAllSlots } from '@/lib/ads';

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

// 모든 광고 슬롯 초기화
export async function DELETE() {
  try {
    await resetAllSlots();
    return NextResponse.json({
      success: true,
      message: '모든 광고 슬롯이 초기화되었습니다.'
    });
  } catch (error) {
    console.error('Reset slots error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 캐시 무효화
export const dynamic = 'force-dynamic';
