'use client';

import { useState, useEffect } from 'react';

// 기술 트렌드 한글 매핑
const TECH_LABELS: Record<string, string> = {
  'ar_vr': 'AR/VR',
  'ai': 'AI/ML',
  'subscription': '구독형',
  'social': '소셜',
  'cloud': '클라우드',
  'blockchain': '블록체인',
  'iot': 'IoT',
  'ml': '머신러닝',
  'realtime': '실시간',
  'offline': '오프라인',
};

// 가격 모델 한글 매핑
const PRICING_LABELS: Record<string, string> = {
  'free': '무료',
  'freemium': '부분유료',
  'subscription': '구독형',
  'onetime': '일회성',
  'paid': '유료',
  'ads': '광고기반',
};

interface TrendData {
  risingCategories: Array<{
    category: string;
    changePercent: number;
    currentCount: number;
  }>;
  hotKeywords: Array<{
    keyword: string;
    count: number;
    category: string;
  }>;
  techTrends: {
    trends: Array<{
      tech: string;
      percent: number;
      count: number;
    }>;
  };
  pricingTrends: {
    distribution: Record<string, { percent: number }>;
    insight: string;
  };
  insight: {
    weekly_theme: string;
    trend_summary: string;
    opportunity: string;
  };
}

export default function TrendSection() {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/trends')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTrends(data.trends);
        }
      })
      .catch(err => console.error('트렌드 로드 실패:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="pixel-box p-4 mb-6 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!trends) {
    return null;
  }

  return (
    <div className="pixel-box overflow-hidden mb-6">
      {/* Header */}
      <div
        className="px-4 py-3 cursor-pointer flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h3 className="font-bold text-white font-pixel">주간 트렌드</h3>
          {trends.insight?.weekly_theme && (
            <span className="text-xs px-2 py-1 bg-white/20 rounded text-white">
              {trends.insight.weekly_theme}
            </span>
          )}
        </div>
        <span className="text-white text-lg">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4" style={{ background: 'var(--pixel-card)' }}>
          {/* Summary */}
          {trends.insight?.trend_summary && (
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              {trends.insight.trend_summary}
            </p>
          )}

          {/* Rising Categories */}
          {trends.risingCategories && trends.risingCategories.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                🚀 급상승 카테고리
              </p>
              <div className="flex flex-wrap gap-2">
                {trends.risingCategories.slice(0, 5).map((cat, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 pixel-tag flex items-center gap-1"
                  >
                    {cat.category}
                    <span className="font-bold" style={{ color: '#5b8c5a' }}>+{cat.changePercent}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hot Keywords */}
          {trends.hotKeywords && trends.hotKeywords.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                🔥 핫 키워드
              </p>
              <div className="flex flex-wrap gap-2">
                {trends.hotKeywords.slice(0, 8).map((kw, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-3 py-1.5"
                    style={{
                      background: idx < 3 ? '#4a2c2c' : '#2a2a3e',
                      border: `3px solid ${idx < 3 ? '#6b3d3d' : '#3a3a50'}`,
                      boxShadow: `inset -2px -2px 0 ${idx < 3 ? '#3a1c1c' : '#1a1a2e'}, inset 2px 2px 0 ${idx < 3 ? '#5a3c3c' : '#3a3a4e'}`,
                      color: idx < 3 ? '#ffb0b0' : 'var(--foreground)'
                    }}
                  >
                    #{kw.keyword}
                    <span className="ml-1 opacity-70">({kw.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tech Trends */}
          {trends.techTrends?.trends && trends.techTrends.trends.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                💻 기술 트렌드
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {trends.techTrends.trends.slice(0, 4).map((tech, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 text-center"
                    style={{
                      background: '#2d2b55',
                      border: '3px solid #4a4680',
                      boxShadow: 'inset -2px -2px 0 #1d1b45, inset 2px 2px 0 #3d3b65'
                    }}
                  >
                    <p className="text-xs font-bold" style={{ color: '#a5a0ff' }}>
                      {TECH_LABELS[tech.tech] || tech.tech}
                    </p>
                    <p className="text-sm font-bold mt-1" style={{ color: '#fff' }}>
                      {tech.percent}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Distribution */}
          {trends.pricingTrends?.distribution && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                💰 가격 모델 분포
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(trends.pricingTrends.distribution)
                  .filter(([key]) => key !== 'unknown')
                  .map(([model, data]) => (
                    <div
                      key={model}
                      className="px-3 py-2 text-center"
                      style={{
                        background: '#1e3a3a',
                        border: '3px solid #2d5555',
                        boxShadow: 'inset -2px -2px 0 #0e2a2a, inset 2px 2px 0 #2e4a4a'
                      }}
                    >
                      <p className="text-xs font-bold" style={{ color: '#7dd3c0' }}>
                        {PRICING_LABELS[model] || model}
                      </p>
                      <p className="text-sm font-bold mt-1" style={{ color: '#fff' }}>
                        {data.percent}%
                      </p>
                    </div>
                  ))
                }
              </div>
              {trends.pricingTrends.insight && (
                <p className="text-xs mt-2 opacity-70" style={{ color: 'var(--foreground)' }}>
                  💡 {trends.pricingTrends.insight}
                </p>
              )}
            </div>
          )}

          {/* Opportunity */}
          {trends.insight?.opportunity && (
            <div className="p-3 pixel-section-insight">
              <p className="text-xs font-bold mb-1" style={{ color: 'var(--pixel-insight)' }}>
                🎯 기회 영역
              </p>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {trends.insight.opportunity}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
