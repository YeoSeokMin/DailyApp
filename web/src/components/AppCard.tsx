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
    <span className="text-yellow-500 text-xs">
      {'★'.repeat(score)}
      {'☆'.repeat(max - score)}
    </span>
  );
}

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const percentage = (score / max) * 100;
  return (
    <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-600 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function RevenueBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    '상': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    '중': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    '하': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[level] || colors['중']}`}>
      {level}
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

  const scoreLabels: Record<string, string> = {
    novelty: '참신성',
    necessity: '필요성',
    timing: '타이밍',
    tech_difficulty: '기술난이도',
    market_size: '시장규모',
    competition: '경쟁강도',
    profitability: '수익성',
    scalability: '확장성',
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Header */}
      <div className={`bg-gradient-to-r ${platformColor} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-xl">#{app.rank}</span>
          <span className="text-white/90 font-medium text-lg truncate">{app.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg">{app.scores?.overall || 0}</span>
          <span className="text-white/70 text-sm">/10</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* App Basic Info */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {app.icon && !imgError ? (
              <Image
                src={app.icon}
                alt={app.name}
                width={56}
                height={56}
                className="rounded-xl"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${platformColor} flex items-center justify-center`}>
                <span className="text-white text-xl font-bold">{app.name?.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{app.developer}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${platformBadgeColor}`}>
              {app.category}
            </span>
            <a
              href={app.app_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block mt-2 text-sm font-medium ${platform === 'iOS' ? 'text-blue-600' : 'text-green-600'} hover:underline`}
            >
              스토어에서 보기 →
            </a>
          </div>
        </div>

        {/* Idea Summary */}
        <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
          <p className="text-zinc-900 dark:text-white font-medium">{app.idea_summary}</p>
        </div>

        {/* Tags */}
        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {app.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Scores Grid */}
        {app.scores && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(scoreLabels).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
                  <div className="flex items-center gap-1">
                    <ScoreBar score={app.scores[key as keyof typeof app.scores] as number || 0} />
                    <span className="text-zinc-700 dark:text-zinc-300 w-3 text-right">
                      {app.scores[key as keyof typeof app.scores] || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Section */}
        {app.analysis && (
          <div className="space-y-2 text-sm">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">해결하는 문제</p>
              <p className="text-zinc-800 dark:text-zinc-200">{app.analysis.problem}</p>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">해결 방식</p>
              <p className="text-zinc-800 dark:text-zinc-200">{app.analysis.solution}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">타겟 사용자</p>
                <p className="text-zinc-800 dark:text-zinc-200">{app.analysis.target_user}</p>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">차별점</p>
                <p className="text-zinc-800 dark:text-zinc-200">{app.analysis.unique_point}</p>
              </div>
            </div>
          </div>
        )}

        {/* Market Section */}
        {app.market && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            <p className="text-blue-800 dark:text-blue-300 font-medium text-xs mb-2">시장 분석</p>
            {app.market.competitors && app.market.competitors.length > 0 && (
              <p className="text-zinc-700 dark:text-zinc-300 mb-1">
                <span className="text-zinc-500">경쟁:</span> {app.market.competitors.join(', ')}
              </p>
            )}
            <p className="text-zinc-700 dark:text-zinc-300 mb-1">
              <span className="text-zinc-500">타이밍:</span> {app.market.timing_reason}
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500">성장성:</span> {app.market.growth_potential}
            </p>
          </div>
        )}

        {/* Business Section */}
        {app.business && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-800 dark:text-green-300 font-medium text-xs">수익 모델</p>
              <RevenueBadge level={app.business.revenue_potential} />
            </div>
            <p className="text-zinc-700 dark:text-zinc-300 mb-1">
              <span className="text-zinc-500">방식:</span> {app.business.monetization}
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500">전략:</span> {app.business.pricing_suggestion}
            </p>
          </div>
        )}

        {/* Dev Insight Section */}
        {app.dev_insight && (
          <div className="p-3 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-sm">
            <p className="text-zinc-800 dark:text-zinc-200 font-medium text-xs mb-2">개발 인사이트</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">개발 기간</p>
                <p className="text-zinc-800 dark:text-zinc-200 font-medium">{app.dev_insight.estimated_period}</p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs">예상 비용</p>
                <p className="text-zinc-800 dark:text-zinc-200 font-medium">{app.dev_insight.estimated_cost}</p>
              </div>
            </div>
            {app.dev_insight.tech_stack && app.dev_insight.tech_stack.length > 0 && (
              <div className="mb-2">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">기술 스택</p>
                <div className="flex flex-wrap gap-1">
                  {app.dev_insight.tech_stack.map((tech, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-zinc-200 dark:bg-zinc-600 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {app.dev_insight.key_features && app.dev_insight.key_features.length > 0 && (
              <div className="mb-2">
                <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">핵심 기능</p>
                <ul className="text-zinc-700 dark:text-zinc-300 text-xs space-y-0.5">
                  {app.dev_insight.key_features.map((feature, idx) => (
                    <li key={idx}>• {feature}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                💡 {app.dev_insight.clone_tip}
              </p>
            </div>
          </div>
        )}

        {/* Verdict */}
        {app.verdict && (
          <div className={`p-3 bg-gradient-to-r ${platformColor} rounded-lg`}>
            <p className="text-white text-sm font-medium">{app.verdict}</p>
          </div>
        )}
      </div>
    </div>
  );
}
