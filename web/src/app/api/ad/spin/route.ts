import { NextRequest, NextResponse } from 'next/server';
import { hashIp, spin, getAvailableSlots } from '@/lib/ads';

// IP 주소 추출
function getClientIp(request: NextRequest): string {
  // Vercel/프록시 환경
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 직접 연결
  return '127.0.0.1';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slotId } = body;

    if (!slotId) {
      return NextResponse.json(
        { success: false, message: '슬롯 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const ipHash = hashIp(clientIp);

    const result = spin(ipHash, slotId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Spin error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 사용 가능한 슬롯 확인 (GET)
export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const ipHash = hashIp(clientIp);
    const availableSlots = getAvailableSlots(ipHash);

    return NextResponse.json({
      success: true,
      availableSlots,
      remainingTries: availableSlots.length
    });
  } catch (error) {
    console.error('Get slots error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
