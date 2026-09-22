/**
 * sitemap.ts — 2026-09-22 신설
 * 이전까지 sitemap.xml 이 404 라 166개 일일 리포트와 520개 심층 리포트가
 * 검색엔진에 노출되지 않았다.
 */
import type { MetadataRoute } from 'next';
import { getAvailableDates } from '@/lib/reports';
import { listDeepReports } from '@/lib/deepReports';

const SITE = 'https://dailyapp.opcodey.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/deep`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ];

  let reportPages: MetadataRoute.Sitemap = [];
  try {
    const dates = getAvailableDates();
    reportPages = dates.map((d) => {
      const dt = new Date(`${d}T00:00:00Z`);
      return {
        url: `${SITE}/report/${d}`,
        lastModified: isNaN(dt.getTime()) ? now : dt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      };
    });
  } catch {
    /* 리포트 목록을 못 읽어도 사이트맵 자체는 나가야 한다 */
  }

  let deepPages: MetadataRoute.Sitemap = [];
  try {
    deepPages = listDeepReports().map((r) => ({
      url: `${SITE}/deep/${r.id}`,
      lastModified: r.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));
  } catch {
    /* 동일 */
  }

  return [...staticPages, ...reportPages, ...deepPages];
}
