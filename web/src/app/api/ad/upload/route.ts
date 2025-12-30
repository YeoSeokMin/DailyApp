import { NextRequest, NextResponse } from 'next/server';
import { hashIp, updateAdSlot, hasAttemptedToday } from '@/lib/ads';
import fs from 'fs';
import path from 'path';

// IP 주소 추출
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return '127.0.0.1';
}

// 허용 이미지 타입
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const slotId = formData.get('slotId') as string | null;
    const winToken = formData.get('winToken') as string | null;

    // 검증
    if (!file || !slotId) {
      return NextResponse.json(
        { success: false, message: '이미지와 슬롯 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'JPG, PNG, GIF, WebP 이미지만 허용됩니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: '이미지 크기는 2MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const ipHash = hashIp(clientIp);

    // 당첨 토큰 검증 (간단한 검증 - 실제로는 더 복잡한 토큰 시스템 필요)
    // 여기서는 오늘 시도한 기록이 있는지로 간단히 검증
    if (!hasAttemptedToday(ipHash, slotId)) {
      return NextResponse.json(
        { success: false, message: '먼저 룰렛에 당첨되어야 합니다.' },
        { status: 403 }
      );
    }

    // 이미지를 public/ads 폴더에 저장
    const adsDir = path.join(process.cwd(), 'public', 'ads');
    if (!fs.existsSync(adsDir)) {
      fs.mkdirSync(adsDir, { recursive: true });
    }

    // 파일명 생성
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${slotId}-${Date.now()}.${ext}`;
    const filepath = path.join(adsDir, filename);

    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(filepath, buffer);

    // 광고 슬롯 업데이트
    const imageUrl = `/ads/${filename}`;
    const updated = updateAdSlot(slotId, imageUrl, ipHash);

    if (!updated) {
      // 실패시 파일 삭제
      fs.unlinkSync(filepath);
      return NextResponse.json(
        { success: false, message: '광고 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '🎉 광고가 등록되었습니다!',
      slotId,
      imageUrl
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
