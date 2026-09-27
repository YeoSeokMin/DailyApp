'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Pusher from 'pusher-js';

interface ChatMessage {
  id: string;
  nickname: string;
  message: string;
  timestamp: number;
}

// 랜덤 닉네임 생성
const ADJECTIVES = ['행복한', '귀여운', '용감한', '똑똑한', '재빠른', '신비한', '멋진', '따뜻한', '시원한', '달콤한'];
const NOUNS = ['고양이', '강아지', '토끼', '여우', '판다', '코알라', '펭귄', '다람쥐', '햄스터', '물개'];

function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

export default function AnonymousChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nickname, setNickname] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 메시지 가져오기 (초기 로드용)
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
      const data = await res.json();
      if (data.success) {
        const newMessages = data.messages.reverse();
        setMessages(newMessages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, []);

  // 스크롤 위치 확인
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 30);
    }
  };

  // 맨 아래로 스크롤
  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // 클라이언트에서만 닉네임 생성
  useEffect(() => {
    setNickname(generateNickname());
  }, []);

  // 초기 로드 + Pusher 구독
  useEffect(() => {
    // 초기 메시지 로드
    fetchMessages();

    // Pusher 연결
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap3';

    // 백업 폴링 (Pusher 연결 실패 시에도 동작)
    const pollInterval = setInterval(fetchMessages, 5000);

    if (!pusherKey) {
      console.warn('Pusher key not configured');
      return () => clearInterval(pollInterval);
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    const channel = pusher.subscribe('chat');

    channel.bind('new-message', (newMessage: ChatMessage) => {
      setMessages(prev => {
        // 중복 방지
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    pusher.connection.bind('connected', () => {
      console.log('Pusher connected');
    });

    pusher.connection.bind('error', (err: Error) => {
      console.error('Pusher error:', err);
    });

    return () => {
      clearInterval(pollInterval);
      channel.unbind_all();
      pusher.unsubscribe('chat');
      pusher.disconnect();
    };
  }, [fetchMessages]);

  // 초기 로드 시 스크롤
  useEffect(() => {
    if (messages.length > 0 && !initialLoaded) {
      scrollToBottom();
      setInitialLoaded(true);
      setIsAtBottom(true);
    }
  }, [messages, initialLoaded]);

  // 새 메시지 올 때 스크롤이 맨 아래면 자동 스크롤
  useEffect(() => {
    if (initialLoaded && isAtBottom && messages.length > 0) {
      setTimeout(scrollToBottom, 50);
    }
  }, [messages.length, isAtBottom, initialLoaded]);

  // 메시지 전송
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !nickname) return;

    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname,
          message: input.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setInput('');
        await fetchMessages();
        setTimeout(scrollToBottom, 100);
      } else {
        setSendError(data.message || '메시지를 보내지 못했습니다.');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError('메시지를 보내지 못했습니다.');
    } finally {
      setSending(false);
    }
  };

  // 시간 포맷
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 pixel-section-chat pixel-box">
      <h3 className="font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--pixel-chat)' }}>
        <span>💬</span>
        익명 채팅방
        <span className="flex items-center gap-1 text-xs font-normal ml-auto" style={{ color: 'var(--pixel-android)' }}>
          <span className="w-2 h-2 animate-pulse" style={{ background: 'var(--pixel-android)' }}></span>
          실시간
        </span>
      </h3>

      {/* 메시지 목록 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="pixel-box-inset h-[200px] overflow-y-auto p-3 mb-3 space-y-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: 'var(--foreground)', opacity: 0.5 }}>
            첫 번째 메시지를 남겨보세요!
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.nickname === nickname;
            return (
              <div
                key={msg.id}
                className={`flex gap-2 text-sm ${isOwn ? 'pixel-box-inset -mx-1 px-2 py-1' : ''}`}
                style={isOwn ? { background: 'var(--pixel-highlight)' } : {}}
              >
                <span
                  className="font-bold shrink-0"
                  style={{ color: isOwn ? 'var(--pixel-android)' : 'var(--pixel-ios)' }}
                >
                  {msg.nickname}
                </span>
                <span className="break-all flex-1" style={{ color: 'var(--foreground)' }}>
                  {msg.message}
                </span>
                <span className="text-xs shrink-0" style={{ color: 'var(--foreground)', opacity: 0.5 }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 새 메시지 알림 (스크롤이 위에 있을 때) */}
      {!isAtBottom && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="w-full mb-2 py-1 text-xs pixel-btn"
          style={{ background: 'var(--pixel-chat)' }}
        >
          ▼ 새 메시지 보기
        </button>
      )}

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지 입력..."
          maxLength={200}
          className="flex-1 min-w-0 text-sm px-3 py-2 pixel-input"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-4 py-2 pixel-btn font-bold"
        >
          {sending ? '...' : '전송'}
        </button>
      </form>
      {sendError && (
        <p role="alert" className="mt-2 text-xs" style={{ color: '#e94560' }}>
          {sendError}
        </p>
      )}
    </div>
  );
}
