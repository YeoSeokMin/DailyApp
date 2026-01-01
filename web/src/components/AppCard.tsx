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
    <span className="pixel-star text-xs">
      {'★'.repeat(score)}
      {'☆'.repeat(max - score)}
    </span>
  );
}

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const percentage = (score / max) * 100;
  return (
    <div className="w-16 pixel-score-bar">
      <div
        className="pixel-score-bar-fill"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function RevenueBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    '상': '#5b8c5a',
    '중': '#d4a574',
    '하': '#c97b7b',
  };
  return (
    <span
      className="text-xs px-2 py-0.5 pixel-badge text-white"
      style={{ background: colors[level] || colors['중'] }}
    >
      {level}
    </span>
  );
}

export default function AppCard({ app, platform }: AppCardProps) {
  const [imgError, setImgError] = useState(false);

  const platformColor = platform === 'iOS' ? 'var(--pixel-ios)' : 'var(--pixel-android)';
  const headerClass = platform === 'iOS' ? 'pixel-card-header-ios' : 'pixel-card-header-android';

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
    <div className="pixel-box overflow-hidden hover:translate-y-[-2px] transition-transform">
      {/* Header */}
      <div className={`${headerClass} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-xl font-pixel">#{app.rank}</span>
          <span className="text-white/90 font-bold text-lg truncate font-pixel">{app.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg font-pixel">{app.scores?.overall || 0}</span>
          <span className="text-white/70 text-sm">/10</span>
        </div>
      </div>

      <div className="p-4 space-y-4" style={{ background: 'var(--pixel-card)' }}>
        {/* App Basic Info */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {app.icon && !imgError ? (
              <Image
                src={app.icon}
                alt={app.name}
                width={56}
                height={56}
                className="pixel-badge"
                style={{ imageRendering: 'pixelated' }}
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <div
                className="w-14 h-14 pixel-badge flex items-center justify-center"
                style={{ background: platformColor }}
              >
                <span className="text-white text-xl font-bold font-pixel">{app.name?.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.7 }}>{app.developer}</p>
            <span
              className="inline-block mt-1 text-xs px-2 py-0.5 pixel-tag"
            >
              {app.category}
            </span>
            <a
              href={app.app_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-sm font-bold hover:opacity-80"
              style={{ color: platformColor }}
            >
              스토어에서 보기 →
            </a>
          </div>
        </div>

        {/* Idea Summary */}
        <div className="p-3 pixel-section-insight">
          <p className="font-bold" style={{ color: 'var(--foreground)' }}>{app.idea_summary}</p>
        </div>

        {/* Tags */}
        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {app.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 pixel-tag"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Scores Grid */}
        {app.scores && (
          <div className="p-3 pixel-section-score">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(scoreLabels).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span style={{ color: 'var(--foreground)', opacity: 0.7 }}>{label}</span>
                  <div className="flex items-center gap-1">
                    <ScoreBar score={app.scores[key as keyof typeof app.scores] as number || 0} />
                    <span className="w-3 text-right font-bold" style={{ color: 'var(--foreground)' }}>
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
            <div className="p-3 pixel-box-inset">
              <p className="text-xs mb-1 font-bold" style={{ color: 'var(--foreground)', opacity: 0.6 }}>해결하는 문제</p>
              <p style={{ color: 'var(--foreground)' }}>{app.analysis.problem}</p>
            </div>
            <div className="p-3 pixel-box-inset">
              <p className="text-xs mb-1 font-bold" style={{ color: 'var(--foreground)', opacity: 0.6 }}>해결 방식</p>
              <p style={{ color: 'var(--foreground)' }}>{app.analysis.solution}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 pixel-box-inset">
                <p className="text-xs mb-1 font-bold" style={{ color: 'var(--foreground)', opacity: 0.6 }}>타겟 사용자</p>
                <p style={{ color: 'var(--foreground)' }}>{app.analysis.target_user}</p>
              </div>
              <div className="p-3 pixel-box-inset">
                <p className="text-xs mb-1 font-bold" style={{ color: 'var(--foreground)', opacity: 0.6 }}>차별점</p>
                <p style={{ color: 'var(--foreground)' }}>{app.analysis.unique_point}</p>
              </div>
            </div>
          </div>
        )}

        {/* Market Section */}
        {app.market && (
          <div className="p-3 pixel-section-market text-sm">
            <p className="font-bold text-xs mb-2" style={{ color: 'var(--pixel-ios)' }}>시장 분석</p>
            {app.market.competitors && app.market.competitors.length > 0 && (
              <p className="mb-1" style={{ color: 'var(--foreground)' }}>
                <span style={{ opacity: 0.6 }}>경쟁:</span> {app.market.competitors.join(', ')}
              </p>
            )}
            <p className="mb-1" style={{ color: 'var(--foreground)' }}>
              <span style={{ opacity: 0.6 }}>타이밍:</span> {app.market.timing_reason}
            </p>
            <p style={{ color: 'var(--foreground)' }}>
              <span style={{ opacity: 0.6 }}>성장성:</span> {app.market.growth_potential}
            </p>
          </div>
        )}

        {/* Business Section */}
        {app.business && (
          <div className="p-3 pixel-section-business text-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-xs" style={{ color: 'var(--pixel-android)' }}>수익 모델</p>
              <RevenueBadge level={app.business.revenue_potential} />
            </div>
            <p className="mb-1" style={{ color: 'var(--foreground)' }}>
              <span style={{ opacity: 0.6 }}>방식:</span> {app.business.monetization}
            </p>
            <p style={{ color: 'var(--foreground)' }}>
              <span style={{ opacity: 0.6 }}>전략:</span> {app.business.pricing_suggestion}
            </p>
          </div>
        )}

        {/* Dev Insight Section */}
        {app.dev_insight && (
          <div className="p-3 pixel-box-inset text-sm">
            <p className="font-bold text-xs mb-2" style={{ color: 'var(--foreground)' }}>개발 인사이트</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className="text-xs" style={{ color: 'var(--foreground)', opacity: 0.6 }}>개발 기간</p>
                <p className="font-bold" style={{ color: 'var(--foreground)' }}>{app.dev_insight.estimated_period}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--foreground)', opacity: 0.6 }}>예상 비용</p>
                <p className="font-bold" style={{ color: 'var(--foreground)' }}>{app.dev_insight.estimated_cost}</p>
              </div>
            </div>
            {app.dev_insight.tech_stack && app.dev_insight.tech_stack.length > 0 && (
              <div className="mb-2">
                <p className="text-xs mb-1" style={{ color: 'var(--foreground)', opacity: 0.6 }}>기술 스택</p>
                <div className="flex flex-wrap gap-1">
                  {app.dev_insight.tech_stack.map((tech, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 pixel-tag">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {app.dev_insight.key_features && app.dev_insight.key_features.length > 0 && (
              <div className="mb-2">
                <p className="text-xs mb-1" style={{ color: 'var(--foreground)', opacity: 0.6 }}>핵심 기능</p>
                <ul className="text-xs space-y-0.5" style={{ color: 'var(--foreground)' }}>
                  {app.dev_insight.key_features.map((feature, idx) => (
                    <li key={idx}>▸ {feature}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="p-2 pixel-section-score">
              <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                💡 {app.dev_insight.clone_tip}
              </p>
            </div>
          </div>
        )}

        {/* Verdict */}
        {app.verdict && (
          <div
            className="p-3 pixel-badge"
            style={{ background: platformColor }}
          >
            <p className="text-white text-sm font-bold">{app.verdict}</p>
          </div>
        )}
      </div>
    </div>
  );
}
