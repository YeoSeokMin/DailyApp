'use client';

import { AppInfo } from '@/types/report';
import Image from 'next/image';
import { useState } from 'react';

interface AppCardProps {
  app: AppInfo;
  platform: 'iOS' | 'Android';
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
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            핵심 아이디어
          </p>
          <p className="text-zinc-900 dark:text-white mt-1">
            {app.핵심아이디어}
          </p>
        </div>

        {/* Details - Always visible */}
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-medium text-zinc-600 dark:text-zinc-300">해결하는 문제</p>
            <p className="text-zinc-800 dark:text-zinc-200 mt-1">{app.해결하는문제}</p>
          </div>
          <div>
            <p className="font-medium text-zinc-600 dark:text-zinc-300">왜 좋은 아이디어인가</p>
            <p className="text-zinc-800 dark:text-zinc-200 mt-1">{app.왜좋은아이디어인가}</p>
          </div>
          <div>
            <p className="font-medium text-zinc-600 dark:text-zinc-300">개발자 참고 포인트</p>
            <p className="text-zinc-800 dark:text-zinc-200 mt-1">{app.개발자참고포인트}</p>
          </div>
          <div>
            <p className="font-medium text-zinc-600 dark:text-zinc-300">수익화 가능성</p>
            <p className="text-zinc-800 dark:text-zinc-200 mt-1">{app.수익화가능성}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
