/**
 * /deep — 심층 분석 리포트 목록 (2026-09-22 신설)
 * 크롤러가 520개 상세 페이지를 발견하는 진입점이자 내부링크 허브.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { listDeepReports } from '@/lib/deepReports';

export const revalidate = 3600;

const SITE = 'https://dailyapp.opcodey.com';

export const metadata: Metadata = {
  title: '앱 심층 분석 리포트 — 수익모델·기술난이도·시장기회',
  description:
    '매일 수집한 iOS·Android 신규 앱을 수익 구조, 기술 난이도, 시장 기회 관점에서 분석한 리포트 모음입니다. 근거가 있는 사실은 [확인], 해석은 [추론]으로 구분해 표기합니다.',
  alternates: { canonical: `${SITE}/deep` },
};

export default async function DeepIndexPage() {
  const reports = listDeepReports();
  const ios = reports.filter((r) => r.platform === 'ios');
  const android = reports.filter((r) => r.platform === 'android');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '앱 심층 분석 리포트',
    description: 'iOS·Android 신규 앱 심층 분석 리포트 모음',
    url: `${SITE}/deep`,
    inLanguage: 'ko',
    hasPart: reports.slice(0, 50).map((r) => ({
      '@type': 'Article',
      headline: `${r.appName} 심층 분석 리포트`,
      url: `${SITE}/deep/${r.id}`,
    })),
  };

  const Section = ({ title, items }: { title: string; items: typeof reports }) => (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-semibold">
        {title} <span className="text-sm font-normal text-gray-400">{items.length}건</span>
      </h2>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="border-b pb-3">
            <Link href={`/deep/${r.id}`} className="font-medium hover:underline">
              {r.appName}
            </Link>
            {r.summary && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{r.summary.slice(0, 160)}</p>}
            <time className="mt-1 block text-xs text-gray-400" dateTime={r.updatedAt.toISOString()}>
              {r.updatedAt.toISOString().slice(0, 10)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:underline">오늘의 앱 아이디어</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">심층 분석</span>
      </nav>

      <header className="mb-8 border-b pb-6">
        <h1 className="text-3xl font-bold">앱 심층 분석 리포트</h1>
        <p className="mt-3 text-gray-600">
          매일 수집한 신규 앱을 수익 구조·기술 난이도·시장 기회 관점에서 분석합니다.
          근거가 확인된 사실은 <code className="rounded bg-gray-100 px-1">[확인]</code>,
          해석은 <code className="rounded bg-gray-100 px-1">[추론]</code>으로 구분해 표기합니다.
        </p>
        <p className="mt-2 text-sm text-gray-400">총 {reports.length}건</p>
      </header>

      {android.length > 0 && <Section title="Android" items={android} />}
      {ios.length > 0 && <Section title="iOS" items={ios} />}
    </main>
  );
}
