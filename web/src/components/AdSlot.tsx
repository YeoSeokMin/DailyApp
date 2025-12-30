'use client';

import { useState } from 'react';
import AdRoulette from './AdRoulette';
import AdUpload from './AdUpload';

interface AdSlotProps {
  slotId: string;
  imageUrl: string | null;
  linkUrl: string | null;
  position: 'left' | 'right';
}

export default function AdSlot({ slotId, imageUrl, linkUrl, position }: AdSlotProps) {
  const [showRoulette, setShowRoulette] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleClick = async () => {
    if (checking) return;
    setChecking(true);

    try {
      const res = await fetch('/api/ad/spin');
      const data = await res.json();

      if (data.success && data.availableSlots) {
        if (data.availableSlots.includes(slotId)) {
          setShowRoulette(true);
        } else {
          showToast('이 슬롯은 오늘 이미 도전했습니다!');
        }
      } else {
        setShowRoulette(true);
      }
    } catch {
      setShowRoulette(true);
    } finally {
      setChecking(false);
    }
  };

  const handleImageClick = () => {
    if (linkUrl) {
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleWin = () => {
    setShowRoulette(false);
    setShowUpload(true);
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    window.location.reload();
  };

  return (
    <>
      {/* 토스트 메시지 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-800 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="w-[160px] h-[300px] bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-700">
        {imageUrl ? (
          <div className="relative w-full h-full group">
            {/* 광고 이미지 - 클릭 시 링크 이동 */}
            <div
              onClick={handleImageClick}
              className={`w-full h-full ${linkUrl ? 'cursor-pointer' : ''}`}
            >
              <img
                src={imageUrl}
                alt="광고"
                className="w-full h-full object-contain bg-zinc-200 dark:bg-zinc-700"
              />
            </div>
            {/* 도전 버튼 오버레이 */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center pointer-events-none">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                disabled={checking}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg disabled:opacity-50 pointer-events-auto"
              >
                {checking ? '확인중...' : '🎰 도전하기'}
              </button>
              <p className="text-xs text-white/70 mt-2">이 자리를 뺏어보세요!</p>
            </div>
            {/* AD 라벨 */}
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
              AD
            </div>
          </div>
        ) : (
          <button
            onClick={handleClick}
            disabled={checking}
            className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors group disabled:opacity-50"
          >
            <div className="text-4xl group-hover:scale-110 transition-transform">
              {checking ? '⏳' : '🎰'}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                무료 광고 등록
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                룰렛 도전하기
              </p>
            </div>
            <div className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full group-hover:from-purple-600 group-hover:to-pink-600 transition-all">
              {checking ? '확인중...' : '도전'}
            </div>
          </button>
        )}
      </div>

      {showRoulette && (
        <AdRoulette
          slotId={slotId}
          onWin={handleWin}
          onClose={() => setShowRoulette(false)}
        />
      )}

      {showUpload && (
        <AdUpload
          slotId={slotId}
          onSuccess={handleUploadSuccess}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  );
}
