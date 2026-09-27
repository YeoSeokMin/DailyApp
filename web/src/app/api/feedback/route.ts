import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// ★예전엔 ../feedback/data/feedback_log.json 에 썼는데 Vercel 파일시스템은 읽기 전용이라
//   운영에선 항상 500 이었다(신고가 한 건도 저장되지 않음). 채팅과 같은 KV 리스트로 옮김.
const FEEDBACK_KEY = 'feedback:list';
const MAX_FEEDBACKS = 1000;
const CATEGORIES = ['accuracy', 'hallucination', 'missing', 'outdated'];

interface Feedback {
  id: string;
  timestamp: string;
  appName: string;
  category: string;
  section: string;
  content: string;
  severity: number;
  resolved: boolean;
  source: string;
}

function generateId() {
  return `fb_web_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// 관리자 키: x-admin-key 헤더 권장 (쿼리 ?key= 는 채팅 DELETE 와 같은 방식이라 함께 허용)
function isAdmin(request: NextRequest): boolean {
  const key = request.headers.get('x-admin-key') || new URL(request.url).searchParams.get('key');
  return !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appName, category, section, content, severity } = body;

    if (typeof appName !== 'string' || !appName.trim() || !CATEGORIES.includes(category) ||
        typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({
        success: false,
        error: '필수 필드 누락',
      }, { status: 400 });
    }

    const feedback: Feedback = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      appName: appName.trim().slice(0, 100),
      category,
      section: typeof section === 'string' && section ? section.slice(0, 50) : 'overall',
      content: content.trim().slice(0, 200),
      severity: Number.isInteger(severity) && severity >= 1 && severity <= 5 ? severity : 3,
      resolved: false,
      source: 'web',
    };

    await kv.lpush(FEEDBACK_KEY, feedback);
    await kv.ltrim(FEEDBACK_KEY, 0, MAX_FEEDBACKS - 1);

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
      message: '피드백이 접수되었습니다',
    });
  } catch (error) {
    console.error('피드백 저장 실패:', error);
    return NextResponse.json({
      success: false,
      error: '피드백 저장 실패',
    }, { status: 500 });
  }
}

// 신고 목록 조회 (관리자용) — GET /api/feedback  헤더 x-admin-key: <ADMIN_KEY>
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
  }
  try {
    const feedbacks = (await kv.lrange<Feedback>(FEEDBACK_KEY, 0, MAX_FEEDBACKS - 1)) || [];
    const byCategory: Record<string, number> = {};
    for (const f of feedbacks) byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    return NextResponse.json({
      success: true,
      total: feedbacks.length,
      byCategory,
      feedbacks,
    });
  } catch (error) {
    console.error('피드백 조회 실패:', error);
    return NextResponse.json({ success: false, error: '피드백 조회 실패' }, { status: 500 });
  }
}
