'use client';

import { useState, useEffect } from 'react';
import AdRoulette from './AdRoulette';
import AdUpload from './AdUpload';
import { AdSlot as AdSlotType } from '@/types/ad';

interface MobileAdSlotProps {
  slotId: string;
}

export default function MobileAdSlot({ slotId }: MobileAdSlotProps) {
  const [slot, setSlot] = useState<AdSlotType | null>(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const fetchSlot = async () => {
      try {
        const res = await fetch('/api/ad/slots');
        const data = await res.json();

        if (data.success && data.slots[slotId]) {
          setSlot(data.slots[slotId]);
        }
      } catch (error) {
        console.error('Failed to fetch ad slot:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSlot();
  }, [slotId]);

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
    if (slot?.linkUrl) {
      window.open(slot.linkUrl, '_blank', 'noopener,noreferrer');
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

  if (loading) {
    return (
      <div className="xl:hidden w-full h-[100px] my-4 pixel-box animate-pulse" style={{ background: 'var(--pixel-highlight)' }} />
    );
  }

  return (
    <>
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pixel-box px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      <div className="xl:hidden pixel-box w-full overflow-hidden my-4">
        {slot?.imageUrl ? (
          <div className="relative h-[100px]" style={{ background: 'var(--pixel-highlight)' }}>
            <div
              onClick={handleImageClick}
              className={`w-full h-full ${slot.linkUrl ? 'cursor-pointer' : ''}`}
            >
              <img
                src={slot.imageUrl}
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
            className="w-full h-[100px] flex items-center justify-center gap-4 hover:opacity-80 transition-opacity"
            style={{ background: 'var(--pixel-card)' }}
          >
            <span className="text-3xl">{checking ? '⏳' : '🎰'}</span>
            <div className="text-left">
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                무료 광고 등록
              </p>
              <p className="text-xs" style={{ color: 'var(--foreground)', opacity: 0.6 }}>
                룰렛 당첨시 광고 게재!
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
