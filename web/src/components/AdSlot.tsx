'use client';

import { useState } from 'react';
import AdRoulette from './AdRoulette';
import AdUpload from './AdUpload';

interface AdSlotProps {
  slotId: string;
  imageUrl: string | null;
  position: 'left' | 'right';
}

export default function AdSlot({ slotId, imageUrl, position }: AdSlotProps) {
  const [showRoulette, setShowRoulette] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [currentImage, setCurrentImage] = useState(imageUrl);

  const handleWin = () => {
    setShowRoulette(false);
    setShowUpload(true);
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    // 페이지 새로고침하여 새 이미지 표시
    window.location.reload();
  };

  return (
    <>
      <div className="w-[160px] h-[300px] bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-700">
        {currentImage ? (
          // 광고 이미지 표시
          <div className="relative w-full h-full group">
            <img
              src={currentImage}
              alt="광고"
              className="w-full h-full object-cover"
            />
            {/* 도전 버튼 오버레이 */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
              <button
                onClick={() => setShowRoulette(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
              >
                🎰 도전하기
              </button>
              <p className="text-xs text-white/70 mt-2">이 자리를 뺏어보세요!</p>
            </div>
            {/* AD 라벨 */}
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
              AD
            </div>
          </div>
        ) : (
          // 빈 슬롯 - 룰렛 버튼 표시
          <button
            onClick={() => setShowRoulette(true)}
            className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors group"
          >
            <div className="text-4xl group-hover:scale-110 transition-transform">
              🎰
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
              도전 →
            </div>
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
