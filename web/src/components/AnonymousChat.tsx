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

  // 초기 로드 시에만 스크롤
  useEffect(() => {
    if (messages.length > 0 && !initialLoaded) {
      scrollToBottom();
      setInitialLoaded(true);
      setIsAtBottom(true);
    }
  }, [messages, initialLoaded]);

  // 메시지 전송
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !nickname) return;

    setSending(true);
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
      }
    } catch (error) {
      console.error('Failed to send message:', error);
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
    <div className="p-5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
      <h3 className="font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-4">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        익명 채팅방
        <span className="flex items-center gap-1 text-xs text-green-500 font-normal ml-auto">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          실시간
        </span>
      </h3>

      {/* 메시지 목록 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="h-[200px] overflow-y-auto bg-white/50 dark:bg-zinc-800/50 rounded-lg p-3 mb-3 space-y-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {messages.length === 0 ? (
          <p className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-8">
            첫 번째 메시지를 남겨보세요!
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.nickname === nickname;
            return (
              <div key={msg.id} className={`flex gap-2 text-sm ${isOwn ? 'bg-blue-50 dark:bg-blue-900/20 -mx-1 px-1 rounded' : ''}`}>
                <span className={`font-medium shrink-0 ${isOwn ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {msg.nickname}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300 break-all flex-1">
                  {msg.message}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
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
          className="w-full mb-2 py-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
        >
          ↓ 새 메시지 보기
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
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 text-white disabled:bg-zinc-300 dark:disabled:bg-zinc-600 disabled:cursor-not-allowed transition-colors"
        >
          <span className="text-lg font-bold">{sending ? '·' : '↑'}</span>
        </button>
      </form>
    </div>
  );
}
