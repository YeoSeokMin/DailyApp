'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AdRouletteProps {
  slotId: string;
  onWin: () => void;
  onClose: () => void;
  onLaterUpload?: () => void;
}

export default function AdRoulette({ slotId, onWin, onClose, onLaterUpload }: AdRouletteProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<'pending' | 'win' | 'lose' | 'existing' | 'already_spun'>('pending');
  const [message, setMessage] = useState('');
  const [rotation, setRotation] = useState(0);
  const [existingWinSlot, setExistingWinSlot] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const spinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSpin = async () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setResult('pending');

    const spins = 5 + Math.random() * 3;
    const newRotation = rotation + spins * 360;
    setRotation(newRotation);

    try {
      const res = await fetch('/api/ad/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId })
      });

      const data = await res.json();

      await new Promise(resolve => setTimeout(resolve, 3000));

      if (data.existingWinSlot) {
        setResult('existing');
        setExistingWinSlot(data.existingWinSlot);
        setMessage(`이미 당첨된 슬롯(${data.existingWinSlot})이 있습니다!`);
      } else if (!data.success) {
        setResult('already_spun');
        setMessage(data.message || '이 슬롯은 오늘 이미 도전했습니다!');
      } else if (data.won) {
        setResult('win');
        setMessage('축하합니다! 당첨되었습니다!');
        setTimeout(() => onWin(), 1500);
      } else {
        setResult('lose');
        setMessage(data.message || '아쉽네요! 다음 기회에!');
      }
    } catch (error) {
      setResult('lose');
      setMessage('오류가 발생했습니다.');
    } finally {
      setIsSpinning(false);
    }
  };

  const handleLaterUpload = () => {
    if (onLaterUpload) {
      onLaterUpload();
    }
    onClose();
  };

  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 99999,
      }}
    >
      <div className="pixel-box max-w-sm w-full p-6">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold font-pixel" style={{ color: 'var(--foreground)' }}>
            🎰 무료 광고 룰렛
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--foreground)', opacity: 0.6 }}>
            당첨 확률 0.1% | 하루 1회
          </p>
        </div>

        {/* 룰렛 */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* 화살표 포인터 (고정) */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2" style={{ zIndex: 20 }}>
              <div
                className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent"
                style={{
                  borderTopColor: '#ff4444',
                  filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.3))'
                }}
              />
            </div>

            {/* 룰렛 휠 (회전) */}
            <div
              ref={spinRef}
              className="w-52 h-52 rounded-full relative overflow-hidden"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 3000ms ease-out',
                border: '5px solid var(--pixel-border)',
                boxShadow: '4px 4px 0 var(--pixel-shadow)'
              }}
            >
              {/* SVG 기반 파이 섹션 */}
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {[...Array(12)].map((_, i) => {
                  const angle = 30;
                  const startAngle = i * angle - 90;
                  const endAngle = startAngle + angle;
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;
                  const x1 = 50 + 50 * Math.cos(startRad);
                  const y1 = 50 + 50 * Math.sin(startRad);
                  const x2 = 50 + 50 * Math.cos(endRad);
                  const y2 = 50 + 50 * Math.sin(endRad);
                  const midAngle = startAngle + angle / 2;
                  const midRad = (midAngle * Math.PI) / 180;
                  const textX = 50 + 32 * Math.cos(midRad);
                  const textY = 50 + 32 * Math.sin(midRad);

                  const fill = i === 0 ? '#34A853' : i % 2 === 0 ? '#333' : '#6366f1';

                  return (
                    <g key={i}>
                      <path
                        d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                        fill={fill}
                        stroke="#1a1a2e"
                        strokeWidth="0.5"
                      />
                      {i === 0 && (
                        <text
                          x={textX}
                          y={textY}
                          fill="white"
                          fontSize="6"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                        >
                          당첨!
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* 중앙 버튼 */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--pixel-card)',
                  border: '4px solid var(--pixel-border)',
                  boxShadow: '2px 2px 0 var(--pixel-shadow)'
                }}
              >
                <span className="text-2xl">🎯</span>
              </div>
            </div>
          </div>
        </div>

        {/* 결과 메시지 */}
        {result !== 'pending' && (
          <div
            className={`text-center mb-4 p-3 ${result === 'win' ? 'pixel-section-business' : 'pixel-box-inset'}`}
          >
            <p className="font-bold" style={{ color: 'var(--foreground)' }}>{message}</p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          {result === 'win' ? (
            <>
              <button
                onClick={handleLaterUpload}
                className="flex-1 px-4 py-2 pixel-btn"
                style={{ background: 'var(--pixel-highlight)', color: 'var(--foreground)' }}
              >
                나중에 업로드
              </button>
              <button
                onClick={onWin}
                className="flex-1 px-4 py-2 pixel-btn font-bold"
                style={{ background: 'var(--pixel-android)' }}
              >
                지금 업로드
              </button>
            </>
          ) : result === 'existing' ? (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 pixel-btn"
              style={{ background: 'var(--pixel-highlight)', color: 'var(--foreground)' }}
            >
              확인 (당첨 슬롯으로 이동)
            </button>
          ) : result === 'already_spun' || result === 'lose' ? (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 pixel-btn"
              style={{ background: 'var(--pixel-highlight)', color: 'var(--foreground)' }}
            >
              닫기
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 pixel-btn"
                style={{ background: 'var(--pixel-highlight)', color: 'var(--foreground)' }}
              >
                닫기
              </button>
              <button
                onClick={handleSpin}
                disabled={isSpinning}
                className="flex-1 px-4 py-2 pixel-btn font-bold"
                style={{ background: isSpinning ? 'var(--pixel-highlight)' : 'var(--pixel-insight)' }}
              >
                {isSpinning ? '돌리는 중...' : '돌리기'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
