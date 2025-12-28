'use client';

import { AppInfo } from '@/types/report';
import Image from 'next/image';
import { useState } from 'react';

interface AppCardProps {
  app: AppInfo;
  platform: 'iOS' | 'Android';
}

function StarRating({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="text-yellow-500">
      {'★'.repeat(score)}
      {'☆'.repeat(max - score)}
    </span>
  );
}

function DifficultyBadge({ level }: { level: number }) {
  const colors = [
    'bg-green-100 text-green-800',
    'bg-lime-100 text-lime-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-800',
  ];
  const labels = ['매우쉬움', '쉬움', '보통', '어려움', '매우어려움'];

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level - 1]}`}>
      {labels[level - 1]}
    </span>
  );
}

export default function AppCard({ app, platform }: AppCardProps) {
  const [imgError, setImgError] = useState(false);

  const platformColor = platform === 'iOS'
    ? 'from-blue-500 to-blue-600'
    : 'from-green-500 to-green-600';

  const platformBadgeColor = platform === 'iOS'
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Header with rank */}
      <div className={`bg-gradient-to-r ${platformColor} px-4 py-2 flex items-center justify-between`}>
        <span className="text-white font-bold text-lg">#{app.순위}</span>
        <span className={`text-xs px-2 py-1 rounded-full ${platformBadgeColor}`}>
          {app.카테고리}
        </span>
      </div>

      {/* App Info */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* App Icon */}
          <div className="flex-shrink-0">
            {app.아이콘 && !imgError ? (
              <Image
                src={app.아이콘}
                alt={app.앱이름}
                width={64}
                height={64}
                className="rounded-xl"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${platformColor} flex items-center justify-center`}>
                <span className="text-white text-2xl font-bold">
                  {app.앱이름.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* App Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white truncate">
              {app.앱이름}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
              {app.개발자}
            </p>
            <a
              href={app.앱링크}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-block mt-2 text-sm font-medium ${
                platform === 'iOS' ? 'text-blue-600' : 'text-green-600'
              } hover:underline`}
            >
              스토어에서 보기 →
            </a>
          </div>
        </div>

        {/* Core Idea */}
        <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
          <p className="text-zinc-900 dark:text-white font-medium">
            {app.핵심아이디어}
          </p>
        </div>

        {/* Score System */}
        <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 dark:text-zinc-400">아이디어</span>
              <StarRating score={app.점수?.아이디어 || 0} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 dark:text-zinc-400">실현가능성</span>
              <StarRating score={app.점수?.실현가능성 || 0} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 dark:text-zinc-400">시장성</span>
              <StarRating score={app.점수?.시장성 || 0} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-600 dark:text-zinc-400 font-medium">종합</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">
                {app.점수?.종합 || 0}/10
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {app.태그 && app.태그.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {app.태그.map((tag, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Development Info */}
        <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">예상 개발 기간</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{app.예상개발기간}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">예상 비용</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{app.예상비용}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 dark:text-zinc-400">난이도</span>
              {app.난이도 && <DifficultyBadge level={app.난이도} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
