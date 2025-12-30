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
      <div className="xl:hidden w-full h-[100px] bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse my-4" />
    );
  }

  return (
    <>
      {/* 토스트 메시지 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-800 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="xl:hidden w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden shadow border border-zinc-200 dark:border-zinc-700 my-4">
        {slot?.imageUrl ? (
          <div className="relative h-[100px] group">
            {/* 광고 이미지 - 클릭 시 링크 이동 */}
            <div
              onClick={handleImageClick}
              className={`w-full h-full ${slot.linkUrl ? 'cursor-pointer' : ''}`}
            >
              <img
                src={slot.imageUrl}
                alt="광고"
                className="w-full h-full object-contain bg-zinc-200 dark:bg-zinc-700"
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              disabled={checking}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-50"
            >
              <span className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg">
                {checking ? '확인중...' : '🎰 이 자리 도전하기'}
              </span>
            </button>
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded pointer-events-none">
              AD
            </div>
          </div>
        ) : (
          <button
            onClick={handleClick}
            disabled={checking}
            className="w-full h-[100px] flex items-center justify-center gap-4 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <span className="text-3xl">{checking ? '⏳' : '🎰'}</span>
            <div className="text-left">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                무료 광고 등록
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                룰렛 당첨시 광고 게재!
              </p>
            </div>
            <span className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full">
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
