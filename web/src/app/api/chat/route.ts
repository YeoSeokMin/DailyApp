import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getPusher, CHAT_CHANNEL, CHAT_EVENT } from '@/lib/pusher';

const CHAT_KEY = 'chat:messages';
const MAX_MESSAGES = 50;

interface ChatMessage {
  id: string;
  nickname: string;
  message: string;
  timestamp: number;
}

// 메시지 조회
export async function GET() {
  try {
    const messages = await kv.lrange<ChatMessage>(CHAT_KEY, 0, MAX_MESSAGES - 1);
    return NextResponse.json({
      success: true,
      messages: messages || []
    });
  } catch (error) {
    console.error('Chat GET error:', error);
    return NextResponse.json({
      success: true,
      messages: []
    });
  }
}

// 메시지 삭제 (관리자용)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');
    const adminKey = searchParams.get('key');

    // 관리자 키 검증
    const ADMIN_SECRET = process.env.ADMIN_KEY || 'REMOVED_SECRET';
    if (adminKey !== ADMIN_SECRET) {
      return NextResponse.json(
        { success: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { success: false, message: '메시지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 모든 메시지 조회
    const messages = await kv.lrange<ChatMessage>(CHAT_KEY, 0, -1);

    // 해당 메시지 찾아서 삭제
    const targetMessage = messages?.find(m => m.id === messageId);
    if (targetMessage) {
      await kv.lrem(CHAT_KEY, 1, targetMessage);
      return NextResponse.json({
        success: true,
        message: '삭제되었습니다.'
      });
    }

    return NextResponse.json(
      { success: false, message: '메시지를 찾을 수 없습니다.' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Chat DELETE error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 메시지 전송
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, message: '메시지를 입력하세요.' },
        { status: 400 }
      );
    }

    if (message.length > 200) {
      return NextResponse.json(
        { success: false, message: '메시지는 200자 이내로 입력하세요.' },
        { status: 400 }
      );
    }

    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      nickname: nickname?.trim() || '익명',
      message: message.trim(),
      timestamp: Date.now()
    };

    // 리스트 앞에 추가
    await kv.lpush(CHAT_KEY, chatMessage);

    // 최대 개수 유지
    await kv.ltrim(CHAT_KEY, 0, MAX_MESSAGES - 1);

    // Pusher로 실시간 전송
    try {
      const pusher = getPusher();
      await pusher.trigger(CHAT_CHANNEL, CHAT_EVENT, chatMessage);
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
    }

    return NextResponse.json({
      success: true,
      message: chatMessage
    });
  } catch (error) {
    console.error('Chat POST error:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
