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
  const [winnerSlot, setWinnerSlot] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleClick = async () => {
    if (checking) return;
    setChecking(true);

    try {
      const res = await fetch('/api/ad/spin');
      const data = await res.json();

      if (data.success) {
        if (data.winnerSlot) {
          setWinnerSlot(data.winnerSlot);
          if (data.winnerSlot === slotId) {
            setShowUpload(true);
          } else {
            showToast(`이미 당첨된 슬롯(${data.winnerSlot})이 있습니다! 먼저 업로드해주세요.`);
          }
        } else if (data.availableSlots?.includes(slotId)) {
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
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pixel-box px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      <div className="pixel-box w-[160px] h-[300px] overflow-hidden">
        {imageUrl ? (
          <div className="relative w-full h-full" style={{ background: 'var(--pixel-highlight)' }}>
            <div
              onClick={handleImageClick}
              className={`w-full h-full ${linkUrl ? 'cursor-pointer' : ''}`}
            >
              <img
                src={imageUrl}
                alt="광고"
                className="w-full h-full object-contain"
                style={{ background: 'var(--pixel-highlight)' }}
              />
            </div>
            <div className="absolute top-2 left-2 px-2 py-0.5 pixel-badge text-white text-xs" style={{ background: 'var(--pixel-border)' }}>
              AD
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              disabled={checking}
              className="absolute top-2 right-2 w-8 h-8 pixel-btn flex items-center justify-center text-lg"
              style={{ background: 'var(--pixel-insight)' }}
              title="이 자리 도전하기"
            >
              {checking ? '⏳' : '🎰'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleClick}
            disabled={checking}
            className="w-full h-full flex flex-col items-center justify-center gap-3 hover:opacity-80 transition-opacity"
            style={{ background: 'var(--pixel-card)' }}
          >
            <div className="text-4xl">
              {checking ? '⏳' : '🎰'}
            </div>
            <div className="text-center">
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                무료 광고 등록
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--foreground)', opacity: 0.6 }}>
                룰렛 도전하기
              </p>
            </div>
            <span className="px-3 py-1 pixel-btn text-xs font-bold" style={{ background: 'var(--pixel-insight)' }}>
              {checking ? '확인중...' : '도전'}
            </span>
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
