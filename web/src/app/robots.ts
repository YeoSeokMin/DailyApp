/**
 * robots.ts — 2026-09-22 신설 (이전까지 robots.txt 404)
 *
 * AI 답변엔진 크롤러를 명시적으로 허용한다. 이 사이트의 콘텐츠는
 * 인용되는 것이 목적이므로 차단할 이유가 없다.
 */
import type { MetadataRoute } from 'next';

const SITE = 'https://dailyapp.opcodey.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // 실제 페이지가 아닌 것만 제외한다
        disallow: ['/api/'],
      },
      // AI 답변엔진 — 인용 대상이 되는 것이 목적이라 명시 허용
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      // 네이버·다음 (국내 검색)
      { userAgent: 'Yeti', allow: '/' },
      { userAgent: 'Daum', allow: '/' },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
