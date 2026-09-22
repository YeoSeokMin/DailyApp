/**
 * collect.js
 *
 * 역할: iOS 앱스토어와 Google 플레이스토어에서 **최근 3일 이내 출시된 신규 앱**만 수집
 * 출력: output/collected_apps.json
 *
 * 핵심 목표: 빛을 보지 못한 좋은 신규 앱 발굴
 * - iOS: NEW_FREE_IOS 컬렉션에서 3일 이내 출시 앱
 * - Android: NEW_FREE 컬렉션에서 3일 이내 출시 앱
 */

const store = require('app-store-scraper');
const gplay = require('google-play-scraper');
// ★Apple 신규앱 피드 동결(2026-07-09~) 대응 — 차트 신규 진입 방식
const { collectIOSChartNew } = require('./iosChartNew');
const fs = require('fs').promises;
const path = require('path');

// 신규 앱 기준
const NEW_APP_DAYS_IOS = 7;      // iOS: 최근 7일 이내
const NEW_APP_DAYS_ANDROID = 7;  // Android: 최근 7일 이내

// 지원 국가
const COUNTRIES = [
  { code: 'kr', name: '한국', lang: 'ko' },
  { code: 'us', name: '미국', lang: 'en' },
  { code: 'jp', name: '일본', lang: 'ja' }
];

// 카테고리 영문 → 한글 변환
const CATEGORY_KO = {
  // iOS 카테고리
  'Games': '게임', 'Entertainment': '엔터테인먼트', 'Photo & Video': '사진 및 비디오',
  'Social Networking': '소셜 네트워킹', 'Music': '음악', 'Productivity': '생산성',
  'Utilities': '유틸리티', 'Lifestyle': '라이프스타일', 'Shopping': '쇼핑',
  'Health & Fitness': '건강 및 피트니스', 'Finance': '금융', 'Education': '교육',
  'News': '뉴스', 'Travel': '여행', 'Food & Drink': '음식 및 음료',
  'Sports': '스포츠', 'Books': '도서', 'Reference': '참고', 'Business': '비즈니스',
  'Weather': '날씨', 'Navigation': '내비게이션', 'Medical': '의료',
  // Android 카테고리
  'Tools': '도구', 'Communication': '커뮤니케이션', 'Video Players & Editors': '동영상 플레이어',
  'Photography': '사진', 'Personalization': '맞춤 설정', 'Maps & Navigation': '지도/내비게이션',
  'Art & Design': '예술/디자인', 'Auto & Vehicles': '자동차', 'Beauty': '뷰티',
  'Books & Reference': '도서/참고자료', 'Dating': '데이트', 'Events': '이벤트',
  'House & Home': '주거/홈', 'Libraries & Demo': '라이브러리', 'Parenting': '육아',
  'Comics': '만화', 'Food & Drink': '음식/음료', 'Health & Fitness': '건강/피트니스',
  'Entertainment': '엔터테인먼트', 'Education': '교육', 'Finance': '금융',
  'Lifestyle': '라이프스타일', 'Shopping': '쇼핑', 'Social': '소셜',
  'Sports': '스포츠', 'Travel & Local': '여행/지역', 'Weather': '날씨',
  'Music & Audio': '음악/오디오', 'News & Magazines': '뉴스/잡지', 'Productivity': '생산성',
  'Business': '비즈니스', 'Medical': '의료', 'Arcade': '아케이드', 'Action': '액션',
  'Adventure': '어드벤처', 'Board': '보드게임', 'Card': '카드게임', 'Casino': '카지노',
  'Casual': '캐주얼', 'Educational': '교육용 게임', 'Puzzle': '퍼즐', 'Racing': '레이싱',
  'Role Playing': 'RPG', 'Simulation': '시뮬레이션', 'Strategy': '전략', 'Trivia': '퀴즈',
  'Word': '단어 게임'
};

/**
 * 한국 시간(KST) 문자열 반환
 */
function getKSTString() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return kst.toISOString().replace('T', ' ').substring(0, 19) + ' KST';
}

/**
 * 날짜를 한국어 형식으로 변환 (2025년 12월 28일)
 */
function formatDateKO(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return dateStr || '';

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 카테고리 한글 변환
 */
function translateCategory(category) {
  if (!category) return '';
  return CATEGORY_KO[category] || category;
}

/**
 * 날짜 문자열 파싱 (다양한 형식 지원)
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // ISO 형식: "2025-12-28T00:00:00-07:00"
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }

  // iOS 형식: "2025-12-28"
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  }

  // Android 한국어 형식: "2025. 12. 28."
  const match = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  return null;
}

/**
 * 신규 앱인지 확인 (최근 N일 이내 출시)
 * @param {string} releaseDate - 출시일
 * @param {number} days - 기준 일수
 */
function isNewApp(releaseDate, days) {
  const release = parseDate(releaseDate);
  if (!release) return false;

  const now = new Date();
  const diffDays = (now - release) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

/**
 * iOS 앱스토어에서 신규 앱 수집 (app-store-scraper) - 단일 국가
 */
async function collectIOSByCountry(country) {
  const allApps = new Map();
  let totalScanned = 0;

  try {
    const apps = await store.list({
      collection: store.collection.NEW_FREE_IOS,
      country: country.code,
      num: 200
    });

    for (const app of apps) {
      totalScanned++;
      if (!allApps.has(app.id) && isNewApp(app.released, NEW_APP_DAYS_IOS)) {
        allApps.set(app.id, {
          id: String(app.id),
          name: app.title,
          developer: app.developer,
          icon: app.icon,
          category: translateCategory(app.primaryGenre || app.genre || ''),
          url: app.url,
          releaseDate: formatDateKO(app.released),
          description: app.description || '',
          country: country.code
        });
      }
    }
  } catch (error) {
    console.error(`  ❌ iOS(${country.name}) 수집 실패:`, error.message);
  }

  return Array.from(allApps.values());
}

/**
 * iOS 앱스토어에서 신규 앱 수집 - 다국가
 */
async function collectIOS() {
  console.log('🍎 iOS 신규 앱 수집 시작... (최근 ' + NEW_APP_DAYS_IOS + '일 이내)');
  const result = {};
  let totalApps = 0;

  for (const country of COUNTRIES) {
    console.log(`  📍 ${country.name}(${country.code.toUpperCase()}) 수집 중...`);
    const apps = await collectIOSByCountry(country);
    result[country.code] = apps;
    totalApps += apps.length;
    console.log(`     → ${apps.length}개 발견`);
    await sleep(500); // API 레이트 리밋 방지
  }

  console.log(`  ✅ iOS 총: ${totalApps}개 신규 앱`);
  return result;
}

/**
 * 대기 함수
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Google 플레이스토어에서 신규 앱 수집 - 단일 국가 (iOS와 동일한 방식)
 */
async function collectAndroidByCountry(country) {
  const allApps = new Map();

  try {
    // NEW_FREE 컬렉션에서 신규 무료 앱 가져오기
    const apps = await gplay.list({
      collection: gplay.collection.NEW_FREE,
      country: country.code,
      lang: country.lang,
      num: 100
    });

    for (const app of apps) {
      if (!allApps.has(app.appId)) {
        allApps.set(app.appId, {
          id: app.appId,
          name: app.title,
          developer: app.developer || '',
          icon: app.icon || '',
          category: translateCategory(app.genre || ''),
          url: app.url || `https://play.google.com/store/apps/details?id=${app.appId}`,
          releaseDate: '', // list에서는 출시일 제공 안됨
          score: app.score || 0,
          description: app.summary || '',
          country: country.code
        });
      }
    }
  } catch (error) {
    console.error(`  ❌ Android(${country.name}) 수집 실패:`, error.message);
  }

  return Array.from(allApps.values());
}

/**
 * Google 플레이스토어에서 신규 앱 수집 - 다국가 (iOS와 동일한 방식)
 */
async function collectAndroid() {
  console.log('🤖 Android 신규 앱 수집 시작... (google-play-scraper)');
  const result = {};
  let totalApps = 0;

  for (const country of COUNTRIES) {
    console.log(`  📍 ${country.name}(${country.code.toUpperCase()}) 수집 중...`);
    const apps = await collectAndroidByCountry(country);
    result[country.code] = apps;
    totalApps += apps.length;
    console.log(`     → ${apps.length}개 발견`);
    await sleep(500); // API 레이트 리밋 방지
  }

  console.log(`  ✅ Android 총: ${totalApps}개 신규 앱`);
  return result;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🚀 앱 데이터 수집 시작 - ' + new Date().toLocaleString('ko-KR'));
  console.log(`📅 기준: iOS=차트 신규 진입(전일 대비) / Android=최근 ${NEW_APP_DAYS_ANDROID}일 출시`);
  console.log(`🌍 대상 국가: ${COUNTRIES.map(c => c.name).join(', ')}`);
  console.log('');

  // 출력 디렉토리 확인
  const outputDir = path.join(__dirname, '../output');
  await fs.mkdir(outputDir, { recursive: true });

  // iOS & Android 앱 수집 (순차 실행 - API 안정성)
  // ★iOS: Apple 의 NEW_*_IOS 컬렉션이 2026-07-09 이후 동결되어(실측: 최신 74일 전)
  //   '최근 N일 출시' 수집이 불가능하다. 살아있는 공식 top-free/top-paid 피드를
  //   매일 스냅샷해 '차트 신규 진입'을 대신 쓴다. 구 collectIOS() 는 미사용.
  const _t = new Date();
  const _todayStr = `${_t.getFullYear()}${String(_t.getMonth() + 1).padStart(2, '0')}${String(_t.getDate()).padStart(2, '0')}`;
  const iosApps = await collectIOSChartNew(COUNTRIES, _todayStr);
  const androidApps = await collectAndroid();

  // 국가별 통계 계산
  const iosTotal = Object.values(iosApps).flat().length;
  const androidTotal = Object.values(androidApps).flat().length;

  // 기존 형식 호환을 위해 한국 앱을 기본으로 설정
  const today = new Date();
  const result = {
    수집일시: getKSTString(),
    날짜: `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`,
    수집기준: { iOS: '차트 신규 진입(전일 대비)', Android: `최근 ${NEW_APP_DAYS_ANDROID}일` },
    지원국가: COUNTRIES.map(c => c.code),
    // 기존 호환용 (한국 앱)
    iOS앱: iosApps.kr || [],
    Android앱: androidApps.kr || [],
    // 다국가 데이터
    iOS앱_다국가: iosApps,
    Android앱_다국가: androidApps
  };

  const outputPath = path.join(outputDir, 'collected_apps.json');
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log('');
  console.log('═'.repeat(50));
  console.log(`✅ 수집 완료!`);
  console.log(`   - iOS: ${iosTotal}개 (KR:${(iosApps.kr||[]).length} / US:${(iosApps.us||[]).length} / JP:${(iosApps.jp||[]).length})`);
  console.log(`   - Android: ${androidTotal}개 (KR:${(androidApps.kr||[]).length} / US:${(androidApps.us||[]).length} / JP:${(androidApps.jp||[]).length})`);
  console.log(`   - 저장: ${outputPath}`);
  console.log('═'.repeat(50));
}

// 실행
main().catch(error => {
  console.error('❌ 수집 실패:', error);
  process.exit(1);
});
