'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  nickname: string;
  message: string;
  timestamp: number;
}

export default function AnonymousChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nickname, setNickname] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 가져오기
  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/chat');
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages.reverse());
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // 초기 로드 및 폴링
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // 3초마다 새로고침
    return () => clearInterval(interval);
  }, []);

  // 새 메시지 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 전송
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim() || '익명',
          message: input.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setInput('');
        fetchMessages();
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
        <span className="text-xs text-blue-500 dark:text-blue-400 font-normal ml-auto">
          실시간 대화
        </span>
      </h3>

      {/* 메시지 목록 */}
      <div className="h-[200px] overflow-y-auto bg-white/50 dark:bg-zinc-800/50 rounded-lg p-3 mb-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-8">
            첫 번째 메시지를 남겨보세요!
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-2 text-sm">
              <span className="font-medium text-blue-600 dark:text-blue-400 shrink-0">
                {msg.nickname}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300 break-all">
                {msg.message}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 ml-auto">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임"
          maxLength={10}
          className="w-20 px-3 py-2 text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          maxLength={200}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? '...' : '전송'}
        </button>
      </form>
    </div>
  );
}
