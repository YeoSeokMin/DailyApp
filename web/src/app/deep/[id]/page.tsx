/**
 * /deep/[id] — 심층 분석 리포트 페이지 (2026-09-22 신설)
 *
 * 520개 리포트가 /api/deep-report/[id] 로만 제공돼 검색엔진이 색인하지 못했다.
 * 정적 생성으로 실제 페이지화한다.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { getDeepReportIds, getDeepReportMeta, getDeepReportRaw } from '@/lib/deepReports';

export const revalidate = 3600;
export const dynamicParams = true;

const SITE = 'https://dailyapp.opcodey.com';

export async function generateStaticParams() {
  return getDeepReportIds().map((id) => ({ id }));
}

function clamp(s: string, min: number, max: number, pad: string): string {
  let t = (s || '').replace(/\s+/g, ' ').trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '…';
  if (t.length < min && pad) t = (t + ' ' + pad).trim().slice(0, max);
  return t;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const meta = getDeepReportMeta(id);
  if (!meta) return { title: '리포트를 찾을 수 없습니다' };

  const platform = meta.platform === 'ios' ? 'iOS' : meta.platform === 'android' ? 'Android' : '';
  // title 50~60자 / description 150~160자 권장치에 맞춘다
  const title = clamp(`${meta.appName} 심층 분석 — ${platform} 앱 아이디어`, 0, 60, '');
  const description = clamp(meta.summary, 150, 160, `${platform} 신규 앱 ${meta.appName} 의 수익모델·기술난이도·시장기회를 분석한 리포트입니다.`);

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/deep/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE}/deep/${id}`,
      type: 'article',
      publishedTime: meta.updatedAt.toISOString(),
    },
  };
}

/** ★AI 생성 콘텐츠라 raw HTML 을 먼저 무력화한 뒤 마크다운을 파싱한다. */
function renderMarkdown(md: string): string {
  // ★본문 첫 H1 은 제거한다 — 페이지 헤더에서 이미 h1 을 렌더하므로
  //   그대로 두면 H1 이 2개가 되어 SEO 상 불리하다.
  const body = md.replace(/^#\s+.*$/m, '').trimStart();
  const escaped = body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 인용문(> )은 이스케이프되면 안 되므로 줄머리만 복원
  const restored = escaped.replace(/^&gt;(\s?)/gm, '>$1');
  return marked.parse(restored, { async: false, gfm: true, breaks: false }) as string;
}

export default async function DeepReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = getDeepReportMeta(id);
  const raw = getDeepReportRaw(id);
  if (!meta || !raw) notFound();

  const html = renderMarkdown(raw);
  const platform = meta.platform === 'ios' ? 'iOS' : meta.platform === 'android' ? 'Android' : '기타';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${meta.appName} 심층 분석 리포트`,
    description: meta.summary.slice(0, 300),
    datePublished: meta.updatedAt.toISOString(),
    dateModified: meta.updatedAt.toISOString(),
    inLanguage: 'ko',
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/deep/${id}` },
    about: { '@type': 'SoftwareApplication', name: meta.appName, operatingSystem: platform, applicationCategory: 'MobileApplication' },
    publisher: { '@type': 'Organization', name: '오늘의 앱 아이디어', url: SITE },
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:underline">오늘의 앱 아이디어</Link>
        <span className="mx-2">/</span>
        <Link href="/deep" className="hover:underline">심층 분석</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{meta.appName}</span>
      </nav>

      <header className="mb-8 border-b pb-6">
        <div className="mb-2 inline-block rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{platform}</div>
        <h1 className="text-3xl font-bold leading-tight">{meta.appName} 심층 분석 리포트</h1>
        {meta.summary && <p className="mt-3 text-gray-600">{meta.summary.slice(0, 240)}</p>}
        <time className="mt-3 block text-sm text-gray-400" dateTime={meta.updatedAt.toISOString()}>
          {meta.updatedAt.toISOString().slice(0, 10)}
        </time>
      </header>

      <article
        className="deep-report prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <footer className="mt-12 border-t pt-6 text-sm text-gray-500">
        <Link href="/deep" className="hover:underline">← 다른 심층 분석 보기</Link>
      </footer>
    </main>
  );
}
