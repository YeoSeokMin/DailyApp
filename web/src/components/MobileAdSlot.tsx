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
      <div className="xl:hidden w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden shadow border border-zinc-200 dark:border-zinc-700 my-4">
        {slot?.imageUrl ? (
          // 광고 이미지 표시
          <div className="relative h-[100px] group">
            <img
              src={slot.imageUrl}
              alt="광고"
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setShowRoulette(true)}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex items-center justify-center"
            >
              <span className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg">
                🎰 이 자리 도전하기
              </span>
            </button>
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
              AD
            </div>
          </div>
        ) : (
          // 빈 슬롯
          <button
            onClick={() => setShowRoulette(true)}
            className="w-full h-[100px] flex items-center justify-center gap-4 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <span className="text-3xl">🎰</span>
            <div className="text-left">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                무료 광고 등록
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                룰렛 당첨시 광고 게재!
              </p>
            </div>
            <span className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full">
              도전 →
            </span>
          </button>
        )}
      </div>

      {/* 룰렛 모달 */}
      {showRoulette && (
        <AdRoulette
          slotId={slotId}
          onWin={handleWin}
          onClose={() => setShowRoulette(false)}
        />
      )}

      {/* 업로드 모달 */}
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
