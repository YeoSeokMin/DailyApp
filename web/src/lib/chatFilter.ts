/**
 * chatFilter.ts — 익명 채팅 금칙어 (2026-09-27)
 *
 * 배경: 운영자 실명을 넣은 욕설이 채팅에 그대로 노출됐다. 서버에서 검사한다.
 * 공백·기호·숫자를 걷어낸 뒤 비교해 "여 석 민", "씨1발", "f.u.c.k" 같은 우회도 막는다.
 * ★오탐 주의: '시바(견)', '새끼(고양이)', '미친' 단독, '씹다' 처럼 일상어와 겹치는 건 넣지 않는다.
 */
const BANNED = [
  // 운영자 실명
  '여석민', 'yeoseokmin',
  // 욕설
  '씨발', '시발', '씨바', '씨빨', 'ㅅㅂ', 'ㅆㅂ', 'ㅅㅂㄹㅁ',
  '병신', '븅신', '빙신', 'ㅂㅅ',
  '좆', '존나', 'ㅈㄴ', '개새끼', '개새기', '개색기', '개색끼', '씹새', '씹년',
  '지랄', 'ㅈㄹ', '미친놈', '미친년', '미친새끼',
  '니애미', '느금', '엠창', '애미뒤', '애비뒤',
  '뻐큐', '뻐쿠', '뽀큐', '퍽큐', '엿먹어',
  'fuck', 'shit', 'bitch',
];

function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}\d_]/gu, '');
}

// ★목록도 같은 정규화를 거쳐야 한다 — NFKC 는 호환 자모(ㅅ U+3145)를 다른 코드포인트(U+1109)로 바꾼다
const BANNED_NORMALIZED = BANNED.map(normalize);

/** 금칙어가 들어 있으면 true */
export function containsBannedWord(...texts: (string | undefined | null)[]): boolean {
  return texts.some((t) => {
    if (!t) return false;
    const n = normalize(t);
    return BANNED_NORMALIZED.some((w) => n.includes(w));
  });
}
