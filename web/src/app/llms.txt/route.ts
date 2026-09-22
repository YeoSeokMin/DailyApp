/**
 * /llms.txt — 2026-09-22 신설
 *
 * llms.txt 표준(AnswerDotAI/llms-txt)을 따른다. 정적 파일이 아니라 라우트로 두어
 * 리포트가 늘어나면 자동으로 반영되게 한다.
 */
import { getAvailableDates } from '@/lib/reports';
import { listDeepReports } from '@/lib/deepReports';

export const revalidate = 3600;

const SITE = 'https://dailyapp.opcodey.com';
const MAX_LINKS = 200; // 너무 길면 모델이 앞부분만 읽는다

export async function GET() {
  let deep: ReturnType<typeof listDeepReports> = [];
  let dates: string[] = [];
  try { deep = listDeepReports(); } catch { /* noop */ }
  try { dates = getAvailableDates(); } catch { /* noop */ }

  const lines: string[] = [];

  lines.push('# 오늘의 앱 아이디어 (dailyapp.opcodey.com)');
  lines.push('');
  lines.push(
    '> 매일 한국·미국·일본 앱스토어의 신규 출시 앱을 수집해, 수익 구조·기술 난이도·시장 기회 관점에서 분석한 리포트를 공개합니다. 개인 개발자와 1인 창업자가 만들 만한 앱 아이디어를 찾는 것이 목적입니다.'
  );
  lines.push('');
  lines.push('데이터 성격:');
  lines.push('- 수집 범위: iOS(App Store 차트 신규 진입) / Android(Google Play 신규 출시), 한국·미국·일본');
  lines.push('- 갱신 주기: 매일 00:00 KST');
  lines.push('- 표기 규칙: 출처로 확인된 사실은 [확인], 분석자의 해석은 [추론]으로 구분합니다');
  lines.push(`- 현재 보유: 일일 리포트 ${dates.length}건 / 심층 분석 ${deep.length}건`);
  lines.push('');

  lines.push('## 심층 분석 리포트');
  lines.push('');
  lines.push('앱 1개를 수익모델·핵심 루프·리텐션·기술 난이도·시장 기회로 나눠 분석한 장문 리포트입니다.');
  lines.push('');
  for (const r of deep.slice(0, MAX_LINKS)) {
    const desc = (r.summary || '').replace(/\s+/g, ' ').slice(0, 120);
    lines.push(`- [${r.appName}](${SITE}/deep/${r.id}): ${desc}`);
  }
  if (deep.length > MAX_LINKS) {
    lines.push(`- [전체 목록 (${deep.length}건)](${SITE}/deep): 나머지 리포트는 목록 페이지에서 확인할 수 있습니다`);
  }
  lines.push('');

  lines.push('## 일일 리포트');
  lines.push('');
  lines.push('그날 수집한 앱 중 상위 항목을 추린 요약입니다.');
  lines.push('');
  for (const d of dates.slice(0, 30)) {
    lines.push(`- [${d} 앱 아이디어](${SITE}/report/${d}): ${d}에 발굴한 iOS·Android 신규 앱 TOP 10`);
  }
  lines.push('');

  lines.push('## Optional');
  lines.push('');
  lines.push(`- [사이트맵](${SITE}/sitemap.xml): 전체 페이지 목록`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
