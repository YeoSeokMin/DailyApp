'use client';

import { useState, useRef } from 'react';

interface AdRouletteProps {
  slotId: string;
  onWin: () => void;
  onClose: () => void;
  onLaterUpload?: () => void; // 나중에 업로드 콜백
}

export default function AdRoulette({ slotId, onWin, onClose, onLaterUpload }: AdRouletteProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<'pending' | 'win' | 'lose' | 'existing'>('pending');
  const [message, setMessage] = useState('');
  const [rotation, setRotation] = useState(0);
  const [existingWinSlot, setExistingWinSlot] = useState<string | null>(null);
  const spinRef = useRef<HTMLDivElement>(null);

  const handleSpin = async () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setResult('pending');

    // 룰렛 애니메이션 시작
    const spins = 5 + Math.random() * 3; // 5~8바퀴
    const newRotation = rotation + spins * 360;
    setRotation(newRotation);

    try {
      const res = await fetch('/api/ad/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId })
      });

      const data = await res.json();

      // 애니메이션 대기 (3초)
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (data.existingWinSlot) {
        // 이미 당첨된 슬롯이 있음
        setResult('existing');
        setExistingWinSlot(data.existingWinSlot);
        setMessage(`이미 당첨된 슬롯(${data.existingWinSlot})이 있습니다!`);
      } else if (data.won) {
        setResult('win');
        setMessage('🎉 축하합니다! 당첨되었습니다!');
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            🎰 무료 광고 룰렛
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            당첨 확률 0.1% | 하루 1회
          </p>
        </div>

        {/* 룰렛 */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* 화살표 */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>

            {/* 룰렛 휠 */}
            <div
              ref={spinRef}
              className="w-48 h-48 rounded-full border-4 border-zinc-300 dark:border-zinc-600 relative overflow-hidden transition-transform duration-[3000ms] ease-out"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {/* 섹터들 */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1/2 h-1/2 origin-bottom-right"
                  style={{
                    transform: `rotate(${i * 30}deg)`,
                    backgroundColor: i === 0 ? '#10b981' : i % 2 === 0 ? '#3b82f6' : '#6366f1'
                  }}
                >
                  <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold">
                    {i === 0 ? '당첨' : '✕'}
                  </span>
                </div>
              ))}

              {/* 중앙 */}
              <div className="absolute inset-0 m-auto w-12 h-12 bg-white dark:bg-zinc-700 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl">🎯</span>
              </div>
            </div>
          </div>
        </div>

        {/* 결과 메시지 */}
        {result !== 'pending' && (
          <div className={`text-center mb-4 p-3 rounded-lg ${
            result === 'win'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
          }`}>
            <p className="font-medium">{message}</p>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          {result === 'win' ? (
            <>
              <button
                onClick={handleLaterUpload}
                className="flex-1 py-3 px-4 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                나중에 업로드
              </button>
              <button
                onClick={onWin}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 shadow-lg"
              >
                지금 업로드
              </button>
            </>
          ) : result === 'existing' ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              확인 (당첨 슬롯으로 이동)
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleSpin}
                disabled={isSpinning}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  isSpinning
                    ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                }`}
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
