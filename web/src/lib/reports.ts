import { DailyReport } from '@/types/report';
import { getDeepReportRaw } from '@/lib/deepReports';
import fs from 'fs';
import path from 'path';

const reportsDir = path.join(process.cwd(), 'data', 'reports');

export function getAvailableDates(): string[] {
  try {
    const files = fs.readdirSync(reportsDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

export function getLatestDate(): string | null {
  const dates = getAvailableDates();
  return dates.length > 0 ? dates[0] : null;
}

export function getReport(date: string): DailyReport | null {
  try {
    const filePath = path.join(reportsDir, `${date}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const report = JSON.parse(content) as DailyReport;
    // 빈/없는 심층 리포트를 가리키면 '심층 분석 보기' 버튼이 빈 모달을 연다 → 연결을 끊어 버튼을 숨긴다
    for (const app of [...(report.ios || []), ...(report.android || [])]) {
      if (app.deep_report_id && !getDeepReportRaw(app.deep_report_id)) app.deep_report_id = null;
    }
    return report;
  } catch {
    return null;
  }
}

export function getLatestReport(): { report: DailyReport; date: string } | null {
  const latestDate = getLatestDate();
  if (!latestDate) return null;

  const report = getReport(latestDate);
  if (!report) return null;

  return { report, date: latestDate };
}
