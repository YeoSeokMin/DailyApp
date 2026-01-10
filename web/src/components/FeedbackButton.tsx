'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface FeedbackButtonProps {
  appName: string;
  section?: string;
}

const FEEDBACK_TYPES = [
  { value: 'accuracy', label: '정보가 틀림', icon: '❌' },
  { value: 'hallucination', label: 'AI가 지어냄', icon: '🤖' },
  { value: 'missing', label: '정보 누락', icon: '📝' },
  { value: 'outdated', label: '오래된 정보', icon: '🕐' },
];

export default function FeedbackButton({ appName, section = 'overall' }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [modalPos, setModalPos] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setModalPos({
        top: rect.bottom + 10,
        right: window.innerWidth - rect.right
      });
    }
    setIsOpen(!isOpen);
  };

  const handleSubmit = async () => {
    if (!selectedType || !content.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName,
          category: selectedType,
          section,
          content: content.trim(),
          severity: selectedType === 'hallucination' ? 5 : 4,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
          setSelectedType('');
          setContent('');
        }, 2000);
      }
    } catch (err) {
      console.error('피드백 제출 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-xs text-green-500 flex items-center gap-1">
        ✅ 감사합니다!
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="text-xs px-2 py-1 opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
        style={{ color: 'var(--foreground)' }}
        title="정보 오류 신고"
      >
        <span>🚨</span>
        <span className="hidden sm:inline">신고</span>
      </button>

      {isOpen && mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div
            className="fixed z-[9999] pixel-box p-3 shadow-lg"
            style={{
              background: 'var(--background)',
              width: '320px',
              top: modalPos.top,
              right: modalPos.right
            }}
          >
            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
              🚨 정보 오류 신고
            </h4>

            {/* Type Selection */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {FEEDBACK_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className="text-xs px-2 py-2 text-left transition-all"
                  style={{
                    background: selectedType === type.value ? '#e94560' : 'var(--pixel-card, #1a1a2e)',
                    color: selectedType === type.value ? '#fff' : 'var(--foreground)',
                    border: '3px solid',
                    borderColor: selectedType === type.value ? '#ff6b6b' : '#3a3a50',
                    boxShadow: selectedType === type.value
                      ? 'inset -2px -2px 0 #c73e54, inset 2px 2px 0 #ff6b6b'
                      : 'inset -2px -2px 0 #0a0a1e, inset 2px 2px 0 #2a2a3e'
                  }}
                >
                  <span className="mr-1">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>

            {/* Content + Submit 가로 배치 */}
            <div className="flex gap-2 items-end">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="어떤 정보가 잘못되었나요?"
                className="flex-1 px-2 py-1.5 text-sm pixel-box-inset"
                style={{
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                }}
                maxLength={200}
              />
              <button
                onClick={handleSubmit}
                disabled={!selectedType || !content.trim() || submitting}
                className="text-xs px-3 py-1.5 pixel-badge text-white disabled:opacity-50 whitespace-nowrap"
                style={{ background: '#e94560' }}
              >
                {submitting ? '...' : '신고'}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
