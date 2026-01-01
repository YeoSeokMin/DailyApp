import AppCard from '@/components/AppCard';
import DateSelector from '@/components/DateSelector';
import ThemeToggle from '@/components/ThemeToggle';
import { getReport, getAvailableDates } from '@/lib/reports';
import { notFound, redirect } from 'next/navigation';

// 60초마다 재검증 (ISR)
export const revalidate = 60;
export const dynamicParams = true;

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

  if (date === availableDates[0]) {
    redirect('/');
  }

  const report = getReport(date);

  if (!report) {
    notFound();
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="pixel-header sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <img src="/favicon.ico" alt="" className="w-10 h-10" style={{ imageRendering: 'pixelated' }} />
              <div>
                <h1 className="text-2xl font-bold font-pixel" style={{ color: 'var(--foreground)' }}>
                  오늘의 앱 아이디어
                </h1>
                <p className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                  매일 발굴하는 숨겨진 보석 앱들
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DateSelector dates={availableDates} currentDate={date} />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date & Daily Insight */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 font-pixel" style={{ color: 'var(--foreground)' }}>
            {report.date}
          </h2>
          {report.daily_insight && (
            <div className="mt-4 p-5 pixel-section-insight pixel-box">
              <h3 className="font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--pixel-insight)' }}>
                <span className="text-xl">⚡</span>
                오늘의 인사이트
              </h3>

              {/* Trend Summary */}
              <p className="font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                {report.daily_insight.trend_summary}
              </p>

              {/* Trend Details */}
              {report.daily_insight.trend_details && report.daily_insight.trend_details.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {report.daily_insight.trend_details.map((detail, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2" style={{ color: 'var(--foreground)' }}>
                      <span style={{ color: 'var(--pixel-insight)' }}>▸</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Hot Categories */}
              {report.daily_insight.hot_categories && report.daily_insight.hot_categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {report.daily_insight.hot_categories.map((cat, idx) => (
                    <span key={idx} className="text-xs px-3 py-1 pixel-tag">
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Opportunity & Action */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="p-3 pixel-box-inset">
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--pixel-insight)' }}>기회 영역</p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{report.daily_insight.opportunity}</p>
                </div>
                <div className="p-3 pixel-box-inset">
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--pixel-insight)' }}>오늘의 액션</p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{report.daily_insight.action_item}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* iOS Section */}
        {report.ios && report.ios.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center pixel-badge overflow-hidden" style={{ background: '#333' }}>
                {/* 레트로 무지개 애플 로고 */}
                <svg viewBox="0 0 24 24" className="w-6 h-6">
                  <defs>
                    <linearGradient id="rainbow2" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#61BB46"/>
                      <stop offset="20%" stopColor="#FDB827"/>
                      <stop offset="40%" stopColor="#F5821F"/>
                      <stop offset="60%" stopColor="#E03A3E"/>
                      <stop offset="80%" stopColor="#963D97"/>
                      <stop offset="100%" stopColor="#009DDC"/>
                    </linearGradient>
                  </defs>
                  <path fill="url(#rainbow2)" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold font-pixel" style={{ color: 'var(--foreground)' }}>
                iOS TOP {report.ios.length}
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {report.ios.map((app) => (
                <AppCard key={app.rank} app={app} platform="iOS" />
              ))}
            </div>
          </section>
        )}

        {/* Android Section */}
        {report.android && report.android.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center pixel-badge overflow-hidden" style={{ background: '#333' }}>
                {/* 클래식 안드로이드 로봇 */}
                <svg viewBox="0 0 24 24" className="w-6 h-6">
                  <path fill="#A4C639" d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 006 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold font-pixel" style={{ color: 'var(--foreground)' }}>
                Android TOP {report.android.length}
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {report.android.map((app) => (
                <AppCard key={app.rank} app={app} platform="Android" />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="pixel-header" style={{ borderBottom: 'none', borderTop: '4px solid var(--pixel-border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
            매일 아침, 숨겨진 보석 앱을 발굴합니다
          </p>
        </div>
      </footer>
    </div>
  );
}
