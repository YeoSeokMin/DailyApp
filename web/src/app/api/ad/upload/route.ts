import { NextRequest, NextResponse } from 'next/server';
import { hashIp, updateAdSlot, hasAttemptedToday } from '@/lib/ads';
import { put } from '@vercel/blob';

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
    const linkUrl = formData.get('linkUrl') as string | null;

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

    // 링크 URL 검증 (있는 경우)
    let validLinkUrl: string | null = null;
    if (linkUrl && linkUrl.trim()) {
      let url = linkUrl.trim();
      // http/https가 없으면 https 추가
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      validLinkUrl = url;
    }

    const clientIp = getClientIp(request);
    const ipHash = hashIp(clientIp);

    // 당첨 검증 - 오늘 시도한 기록이 있어야 함
    if (!(await hasAttemptedToday(ipHash, slotId))) {
      return NextResponse.json(
        { success: false, message: '먼저 룰렛에 당첨되어야 합니다.' },
        { status: 403 }
      );
    }

    // 파일명 생성
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `ads/${slotId}-${Date.now()}.${ext}`;

    // Vercel Blob에 업로드
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false
    });

    // 광고 슬롯 업데이트
    const updated = await updateAdSlot(slotId, blob.url, validLinkUrl, ipHash);

    if (!updated) {
      return NextResponse.json(
        { success: false, message: '광고 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '광고가 등록되었습니다!',
      slotId,
      imageUrl: blob.url,
      linkUrl: validLinkUrl
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
