import { DailyReport } from '@/types/report';
import fs from 'fs';
import path from 'path';

const reportsDir = path.join(process.cwd(), 'data', 'reports');

export function getAvailableDates(): string[] {
  try {
    const files = fs.readdirSync(reportsDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .sort((a, b) => b.localeCompare(a)); // 최신순 정렬
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
    return JSON.parse(content) as DailyReport;
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
