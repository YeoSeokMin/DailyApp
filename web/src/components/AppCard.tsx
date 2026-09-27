'use client';

import { AppInfo } from '@/types/report';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import FeedbackButton from './FeedbackButton';

interface AppCardProps {
  app: AppInfo;
  platform: 'iOS' | 'Android';
}

function QualityBadge({ score }: { score: number }) {
  let color = '#888';
  let label = '';

  if (score >= 8) {
    color = '#4ecca3';
    label = '높음';
  } else if (score >= 6) {
    color = '#f9a825';
    label = '보통';
  } else {
    color = '#e94560';
    label = '낮음';
  }

  return (
    <span
      className="text-xs px-2 py-0.5 rounded"
      style={{ background: color, color: 'white' }}
      title={`신뢰도: ${score}/10`}
    >
      신뢰도 {label}
    </span>
  );
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

// Confidence 태그 스타일링
function ConfidenceTag({ tag }: { tag: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    '[확인]': { bg: '#22c55e20', text: '#22c55e', label: '확인' },
    '[추론]': { bg: '#3b82f620', text: '#3b82f6', label: '추론' },
    '[추측]': { bg: '#f59e0b20', text: '#f59e0b', label: '추측' },
  };
  const style = styles[tag] || { bg: '#88888820', text: '#888', label: tag };
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded ml-1 font-medium"
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

// 텍스트에서 Confidence 태그와 Bold 처리
function RenderText({ text }: { text: string }) {
  const parts = text.split(/(\[확인\]|\[추론\]|\[추측\]|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.match(/^\[확인\]|\[추론\]|\[추측\]$/)) {
          return <ConfidenceTag key={i} tag={part} />;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold" style={{ color: 'var(--foreground)' }}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// 심층 분석 모달 컴포넌트
function DeepAnalysisModal({
  isOpen,
  onClose,
  content,
  appName,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  appName: string;
  isLoading: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 목차 추출
  const extractTOC = (md: string) => {
    const headings: { level: number; text: string; id: string }[] = [];
    md.split('\n').forEach(line => {
      if (line.startsWith('## ')) {
        const text = line.slice(3).trim();
        headings.push({ level: 2, text, id: text.replace(/\s+/g, '-').toLowerCase() });
      }
    });
    return headings;
  };

  const toc = content ? extractTOC(content) : [];

  // 스크롤 스파이 - 현재 보이는 섹션 감지
  useEffect(() => {
    if (!isOpen || !mounted || toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px', // 상단 20% 지점에서 감지
        threshold: 0
      }
    );

    // 약간의 딜레이 후 옵저버 연결 (DOM 렌더링 대기)
    const timer = setTimeout(() => {
      toc.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [isOpen, mounted, toc]);

  if (!isOpen || !mounted) return null;

  // 마크다운 렌더링
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    let inTable = false;
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];

    const result: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      // 코드 블록 처리
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          result.push(
            <pre key={idx} className="my-3 p-4 rounded-lg text-sm overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', color: '#e2e8f0' }}>
              <code>{codeContent.join('\n')}</code>
            </pre>
          );
          codeContent = [];
        }
        inCodeBlock = !inCodeBlock;
        return;
      }
      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // 테이블 처리
      if (line.startsWith('|')) {
        if (line.includes('---')) return; // 구분선 스킵
        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(cells);
        return;
      } else if (inTable) {
        // 테이블 끝
        result.push(
          <div key={`table-${idx}`} className="my-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                  {tableRows[0]?.map((cell, cidx) => (
                    <th key={cidx} className="px-3 py-2 text-left font-bold border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--foreground)' }}>
                      <RenderText text={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, ridx) => (
                  <tr key={ridx} style={{ background: ridx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    {row.map((cell, cidx) => (
                      <td key={cidx} className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', color: 'var(--foreground)' }}>
                        <RenderText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }

      // H1 - 앱 이름
      if (line.startsWith('# ')) {
        const text = line.slice(2);
        result.push(
          <h1 key={idx} className="text-2xl md:text-3xl font-bold mt-2 mb-4 pb-3 font-pixel border-b-2" style={{ color: 'var(--pixel-ios)', borderColor: 'var(--pixel-ios)' }}>
            <RenderText text={text} />
          </h1>
        );
        return;
      }

      // H2 - 섹션
      if (line.startsWith('## ')) {
        const text = line.slice(3);
        const id = text.replace(/\s+/g, '-').toLowerCase();
        result.push(
          <h2 key={idx} id={id} className="text-lg md:text-xl font-bold mt-8 mb-3 pb-2 border-b flex items-start gap-2" style={{ color: 'var(--foreground)', borderColor: 'rgba(255,255,255,0.1)', wordBreak: 'keep-all' }}>
            <span className="w-1 h-6 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--pixel-ios)' }} />
            <span><RenderText text={text} /></span>
          </h2>
        );
        return;
      }

      // H3 - 서브섹션
      if (line.startsWith('### ')) {
        const text = line.slice(4);
        result.push(
          <h3 key={idx} className="text-base md:text-lg font-bold mt-5 mb-2 flex items-start gap-2" style={{ color: 'var(--foreground)', opacity: 0.95, wordBreak: 'keep-all' }}>
            <span className="flex-shrink-0" style={{ color: 'var(--pixel-ios)' }}>▸</span>
            <span><RenderText text={text} /></span>
          </h3>
        );
        return;
      }

      // 인용문 (한줄 요약 등)
      if (line.startsWith('> ')) {
        const text = line.slice(2);
        result.push(
          <blockquote key={idx} className="my-4 p-4 rounded-lg border-l-4" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--pixel-ios)', color: 'var(--foreground)' }}>
            <RenderText text={text} />
          </blockquote>
        );
        return;
      }

      // 리스트
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.slice(2);
        result.push(
          <li key={idx} className="ml-5 my-1.5 flex items-start gap-2" style={{ color: 'var(--foreground)' }}>
            <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--pixel-ios)' }} />
            <span className="leading-relaxed"><RenderText text={text} /></span>
          </li>
        );
        return;
      }

      // 숫자 리스트
      if (/^\d+\. /.test(line)) {
        const match = line.match(/^(\d+)\. (.*)$/);
        if (match) {
          result.push(
            <li key={idx} className="ml-5 my-1.5 flex items-start gap-3" style={{ color: 'var(--foreground)' }}>
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--pixel-ios)', color: 'white' }}>
                {match[1]}
              </span>
              <span className="leading-relaxed pt-0.5"><RenderText text={match[2]} /></span>
            </li>
          );
        }
        return;
      }

      // 구분선
      if (line.match(/^-{3,}$/)) {
        result.push(<hr key={idx} className="my-6" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />);
        return;
      }

      // 빈 줄
      if (!line.trim()) {
        result.push(<div key={idx} className="h-3" />);
        return;
      }

      // 일반 텍스트
      result.push(
        <p key={idx} className="my-2 leading-relaxed" style={{ color: 'var(--foreground)', opacity: 0.9 }}>
          <RenderText text={line} />
        </p>
      );
    });

    return result;
  };

  return createPortal(
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* 모달 */}
      <div
        className="fixed z-[9999] inset-2 md:inset-6 lg:inset-12 rounded-xl overflow-hidden flex flex-col shadow-2xl"
        style={{ background: 'var(--pixel-card)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ background: 'linear-gradient(135deg, var(--pixel-ios), #1e40af)', borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white font-pixel">
                {appName}
              </h2>
              <p className="text-xs text-white/70">Deep Analysis Report</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* 본문 - TOC + 콘텐츠 */}
        <div className="flex-1 flex overflow-hidden">
          {/* TOC 사이드바 (데스크탑) */}
          {toc.length > 0 && (
            <nav className="hidden lg:block w-56 flex-shrink-0 border-r overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
              <p className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--foreground)', opacity: 0.5 }}>목차</p>
              <ul className="space-y-1">
                {toc.map((item, i) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={i} className="relative">
                      {/* 활성 인디케이터 */}
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full transition-all duration-300"
                        style={{
                          background: isActive ? 'var(--pixel-ios)' : 'transparent',
                          opacity: isActive ? 1 : 0
                        }}
                      />
                      <a
                        href={`#${item.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                          setActiveSection(item.id);
                        }}
                        className="block pl-3 pr-2 py-2 rounded-r-lg text-sm transition-all duration-300 hover:bg-white/5 whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          color: isActive ? 'var(--pixel-ios)' : 'var(--foreground)',
                          opacity: isActive ? 1 : 0.6,
                          fontWeight: isActive ? 600 : 400,
                          background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                        }}
                        title={item.text}
                      >
                        {item.text}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          {/* 콘텐츠 */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8" style={{ wordBreak: 'keep-all' }}>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-bounce text-5xl mb-4">🔬</div>
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>심층 분석 리포트 로딩 중...</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--foreground)', opacity: 0.5 }}>잠시만 기다려주세요</p>
                  </div>
                </div>
              ) : content ? (
                <article className="deep-report">
                  {renderMarkdown(content)}
                </article>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="text-5xl mb-4">📭</div>
                    <p style={{ color: 'var(--foreground)', opacity: 0.6 }}>리포트를 불러올 수 없습니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t text-xs" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)', color: 'var(--foreground)', opacity: 0.5 }}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} /> 확인됨</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} /> 추론</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} /> 추측</span>
          </div>
          <span>ESC로 닫기</span>
        </div>
      </div>
    </>,
    document.body
  );
}

// 국가 플래그 컴포넌트
function CountryFlag({ country }: { country?: string }) {
  const flags: Record<string, { flag: string; name: string }> = {
    'kr': { flag: '🇰🇷', name: '한국' },
    'us': { flag: '🇺🇸', name: '미국' },
    'jp': { flag: '🇯🇵', name: '일본' }
  };
  const info = flags[country || 'kr'] || flags['kr'];
  return (
    <span title={info.name} className="text-sm">
      {info.flag}
    </span>
  );
}

export default function AppCard({ app, platform }: AppCardProps) {
  const [imgError, setImgError] = useState(false);
  const [showDeepModal, setShowDeepModal] = useState(false);
  const [deepReport, setDeepReport] = useState('');
  const [deepLoading, setDeepLoading] = useState(false);

  const platformColor = platform === 'iOS' ? 'var(--pixel-ios)' : 'var(--pixel-android)';

  // 심층 분석 리포트 불러오기
  const handleDeepAnalysis = async () => {
    if (!app.deep_report_id) {
      alert('심층 분석이 없습니다.');
      return;
    }

    setShowDeepModal(true);
    setDeepLoading(true);

    try {
      const res = await fetch(`/api/deep-report/${app.deep_report_id}`);
      if (!res.ok) throw new Error('Not found');
      const markdown = await res.text();
      setDeepReport(markdown);
    } catch (error) {
      console.error('심층 분석 로드 실패:', error);
      setDeepReport('');
    } finally {
      setDeepLoading(false);
    }
  };
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
      <div className={`${headerClass} px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-white font-bold text-base md:text-xl font-pixel flex-shrink-0">#{app.rank}</span>
          <CountryFlag country={app.country} />
          <span className="text-white/90 font-bold text-sm md:text-lg truncate font-pixel">{app.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-white font-bold text-base md:text-lg font-pixel">{app.scores?.overall || 0}</span>
            <span className="text-white/70 text-xs md:text-sm">/10</span>
          </div>
          <FeedbackButton appName={app.name} />
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
            {/* AI 가 app_url 에 "미확인"·"정보 없음" 을 넣은 리포트가 있어 상대경로 404 링크가 됐다 */}
            {/^https?:\/\//.test(app.app_url || '') && (
              <a
                href={app.app_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-sm font-bold hover:opacity-80"
                style={{ color: platformColor }}
              >
                스토어에서 보기 →
              </a>
            )}
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

        {/* 심층 분석 버튼 */}
        {app.deep_report_id && (
          <button
            onClick={handleDeepAnalysis}
            className="w-full mt-3 py-2 px-4 pixel-box text-sm font-bold transition-all hover:translate-y-[-1px]"
            style={{
              background: 'var(--pixel-card)',
              color: 'var(--pixel-ios)',
              border: '3px solid var(--pixel-ios)'
            }}
          >
            🔬 심층 분석 보기
          </button>
        )}
      </div>

      {/* 심층 분석 모달 */}
      <DeepAnalysisModal
        isOpen={showDeepModal}
        onClose={() => setShowDeepModal(false)}
        content={deepReport}
        appName={app.name}
        isLoading={deepLoading}
      />
    </div>
  );
}
