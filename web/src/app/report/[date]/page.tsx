import AppCard from '@/components/AppCard';
import DateSelector from '@/components/DateSelector';
import { getReport, getAvailableDates } from '@/lib/reports';
import { notFound, redirect } from 'next/navigation';

interface ReportPageProps {
  params: Promise<{ date: string }>;
}

export async function generateStaticParams() {
  const dates = getAvailableDates();
  return dates.map((date) => ({ date }));
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { date } = await params;
  const availableDates = getAvailableDates();

  // 최신 날짜면 홈으로 리다이렉트
  if (date === availableDates[0]) {
    redirect('/');
  }

  const report = getReport(date);

  if (!report) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                오늘의 앱 아이디어
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                매일 발굴하는 숨겨진 보석 앱들
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DateSelector dates={availableDates} currentDate={date} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date & Insight */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-white">
            {report.날짜}
          </h2>
          {report.트렌드인사이트 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
              <h3 className="font-medium text-purple-800 dark:text-purple-300 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                트렌드 인사이트
              </h3>
              <p className="mt-2 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
                {report.트렌드인사이트}
              </p>
            </div>
          )}
        </div>

        {/* iOS Section */}
        {report.iOS && report.iOS.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83z"/>
                  <path d="M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-zinc-800 dark:text-white">
                iOS TOP {report.iOS.length}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.iOS.map((app) => (
                <AppCard key={app.순위} app={app} platform="iOS" />
              ))}
            </div>
          </section>
        )}

        {/* Android Section */}
        {report.Android && report.Android.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.523 15.34c-.5 0-.909-.312-.909-.697s.409-.697.91-.697c.5 0 .908.312.908.697s-.408.697-.909.697zm-11.046 0c-.5 0-.909-.312-.909-.697s.409-.697.91-.697c.5 0 .908.312.908.697s-.408.697-.909.697zm11.402-5.77l1.994-3.455a.415.415 0 00-.151-.566.416.416 0 00-.567.151l-2.018 3.497A12.24 12.24 0 0012 8.465a12.24 12.24 0 00-5.137.732L4.845 5.7a.416.416 0 00-.567-.151.415.415 0 00-.151.566l1.994 3.455C2.63 11.467 0 14.95 0 19h24c0-4.05-2.63-7.533-6.121-9.43z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-zinc-800 dark:text-white">
                Android TOP {report.Android.length}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.Android.map((app) => (
                <AppCard key={app.순위} app={app} platform="Android" />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            신규 앱 중 아이디어가 좋은 앱을 AI가 매일 선별합니다
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
            Powered by Claude AI
          </p>
        </div>
      </footer>
    </div>
  );
}
