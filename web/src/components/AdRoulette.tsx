'use client';

import { useState, useRef } from 'react';

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
  const spinRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
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
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent" style={{ borderTopColor: 'var(--pixel-secondary)' }} />
            </div>

            <div
              ref={spinRef}
              className="w-48 h-48 relative overflow-hidden transition-transform duration-[3000ms] ease-out"
              style={{
                transform: `rotate(${rotation}deg)`,
                border: '4px solid var(--pixel-border)',
                boxShadow: '4px 4px 0 var(--pixel-shadow)'
              }}
            >
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1/2 h-1/2 origin-bottom-right"
                  style={{
                    transform: `rotate(${i * 30}deg)`,
                    backgroundColor: i === 0 ? 'var(--pixel-android)' : i % 2 === 0 ? 'var(--pixel-ios)' : 'var(--pixel-insight)'
                  }}
                >
                  <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold font-pixel">
                    {i === 0 ? '당첨' : '✕'}
                  </span>
                </div>
              ))}

              <div
                className="absolute inset-0 m-auto w-12 h-12 flex items-center justify-center"
                style={{
                  background: 'var(--pixel-card)',
                  border: '3px solid var(--pixel-border)',
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
}
