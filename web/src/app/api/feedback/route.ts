import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FEEDBACK_DIR = path.join(process.cwd(), '..', 'feedback', 'data');
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, 'feedback_log.json');

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

interface FeedbackData {
  feedbacks: Feedback[];
  stats: Record<string, number>;
  lastUpdated: string | null;
}

function loadFeedback(): FeedbackData {
  try {
    if (!fs.existsSync(FEEDBACK_DIR)) {
      fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
    }
    if (fs.existsSync(FEEDBACK_FILE)) {
      const content = fs.readFileSync(FEEDBACK_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('피드백 로드 실패:', e);
  }
  return { feedbacks: [], stats: {}, lastUpdated: null };
}

function saveFeedback(data: FeedbackData) {
  data.lastUpdated = new Date().toISOString();
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return `fb_web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appName, category, section, content, severity } = body;

    if (!appName || !category || !content) {
      return NextResponse.json({
        success: false,
        error: '필수 필드 누락',
      }, { status: 400 });
    }

    const data = loadFeedback();

    const feedback: Feedback = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      appName,
      category,
      section: section || 'overall',
      content,
      severity: severity || 3,
      resolved: false,
      source: 'web',
    };

    data.feedbacks.push(feedback);

    // 통계 업데이트
    if (!data.stats.byCategory) data.stats.byCategory = {};
    data.stats.byCategory[category] = (data.stats.byCategory[category] || 0) + 1;
    data.stats.total = (data.stats.total || 0) + 1;

    saveFeedback(data);

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

export async function GET() {
  try {
    const data = loadFeedback();
    return NextResponse.json({
      success: true,
      stats: data.stats,
      recentCount: data.feedbacks.filter(f => !f.resolved).length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '통계 로드 실패',
    });
  }
}
