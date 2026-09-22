/**
 * deepReports.ts — 심층 분석 리포트 색인/조회 (2026-09-22)
 *
 * 배경: 520개 심층 리포트가 /api/deep-report/[id] 로만 제공돼 검색엔진이
 *       페이지로 인식하지 못했다. 정적 페이지로 노출하기 위한 로더.
 */
import fs from 'fs';
import path from 'path';

const deepDir = path.join(process.cwd(), 'data', 'deep-reports');

export type DeepReportMeta = {
  id: string;
  platform: 'ios' | 'android' | 'unknown';
  appName: string;
  summary: string;
  updatedAt: Date;
};

function safeReadDir(): string[] {
  try {
    return fs.readdirSync(deepDir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/** 파일명: {platform}-{슬러그}-{timestamp}.md */
function parseId(id: string): { platform: DeepReportMeta['platform']; ts: number | null } {
  const m = id.match(/^(ios|android)-(.*)-(\d{10,})$/);
  if (!m) return { platform: 'unknown', ts: null };
  return { platform: m[1] as 'ios' | 'android', ts: Number(m[3]) };
}

/** 본문에서 제목과 한줄요약을 뽑는다. 메타데이터로 쓰인다. */
function extractMeta(md: string): { appName: string; summary: string } {
  let appName = '';
  let summary = '';

  const h1 = md.match(/^#\s+(.+?)\s*$/m);
  if (h1) appName = h1[1].replace(/\s*심층\s*분석\s*리포트\s*$/, '').trim();

  // "## 한줄 요약" 다음의 인용문 또는 첫 문단
  const sec = md.match(/##\s*한줄\s*요약\s*\n+([\s\S]*?)(?=\n#{2,}|\n---|\n*$)/);
  if (sec) {
    summary = sec[1]
      .split('\n')
      .map((l) => l.replace(/^>\s?/, '').trim())
      .filter(Boolean)
      .join(' ');
  }
  if (!summary) {
    const firstPara = md.replace(/^#.*$/m, '').split('\n\n').map((s) => s.trim()).find((s) => s && !s.startsWith('#') && !s.startsWith('---'));
    summary = firstPara ?? '';
  }

  summary = summary
    .replace(/\[(확인|추론|추정)\]/g, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { appName, summary };
}

export function getDeepReportIds(): string[] {
  return safeReadDir().map((f) => f.replace(/\.md$/, ''));
}

export function getDeepReportRaw(id: string): string | null {
  // 경로 조작 방지 — API 라우트와 같은 기준
  if (!id || /[\/\\]/.test(id) || id.includes('..')) return null;
  try {
    return fs.readFileSync(path.join(deepDir, `${id}.md`), 'utf-8');
  } catch {
    return null;
  }
}

export function getDeepReportMeta(id: string): DeepReportMeta | null {
  const md = getDeepReportRaw(id);
  if (!md) return null;
  const { platform, ts } = parseId(id);
  const { appName, summary } = extractMeta(md);
  let updatedAt = ts ? new Date(ts) : new Date();
  if (isNaN(updatedAt.getTime())) updatedAt = new Date();
  return {
    id,
    platform,
    appName: appName || id,
    summary,
    updatedAt,
  };
}

/** 목록 페이지/사이트맵용 — 최신순 */
export function listDeepReports(): DeepReportMeta[] {
  return getDeepReportIds()
    .map((id) => getDeepReportMeta(id))
    .filter((x): x is DeepReportMeta => x !== null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
