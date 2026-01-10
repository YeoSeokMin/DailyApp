/**
 * competitiveResearch.js
 *
 * 자동 경쟁앱 조사 시스템
 * - 같은 카테고리 Top 앱 수집
 * - 키워드 기반 검색
 * - 비교 매트릭스 생성
 * - 시장 갭 분석
 */

const store = require('app-store-scraper');
const gplay = require('google-play-scraper');

// 카테고리 매핑 (한글 → 영문)
const CATEGORY_MAP = {
  '게임': 'Games', '엔터테인먼트': 'Entertainment', '사진 및 비디오': 'Photo & Video',
  '소셜 네트워킹': 'Social Networking', '음악': 'Music', '생산성': 'Productivity',
  '유틸리티': 'Utilities', '라이프스타일': 'Lifestyle', '쇼핑': 'Shopping',
  '건강 및 피트니스': 'Health & Fitness', '금융': 'Finance', '교육': 'Education',
  '뉴스': 'News', '여행': 'Travel', '음식 및 음료': 'Food & Drink',
  '스포츠': 'Sports', '도서': 'Books', '비즈니스': 'Business', '날씨': 'Weather',
  '의료': 'Medical', '도구': 'Tools', '커뮤니케이션': 'Communication'
};

// 역매핑
const CATEGORY_MAP_REVERSE = Object.fromEntries(
  Object.entries(CATEGORY_MAP).map(([k, v]) => [v, k])
);

/**
 * 대기 함수
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 앱스토어 검색 (iOS)
 */
async function searchIOS({ term, category, country = 'kr', limit = 20 }) {
  try {
    if (term) {
      return await store.search({
        term,
        country,
        num: limit,
        lang: 'ko'
      });
    } else if (category) {
      const categoryEn = CATEGORY_MAP[category] || category;
      return await store.list({
        category: store.category[categoryEn.toUpperCase().replace(/ /g, '_')] || 6014,
        collection: store.collection.TOP_FREE_IOS,
        country,
        num: limit
      });
    }
    return [];
  } catch (err) {
    console.error('iOS 검색 실패:', err.message);
    return [];
  }
}

/**
 * 플레이스토어 검색 (Android)
 */
async function searchAndroid({ term, category, country = 'kr', limit = 20 }) {
  try {
    if (term) {
      return await gplay.search({
        term,
        country,
        num: limit,
        lang: 'ko'
      });
    } else if (category) {
      const categoryEn = CATEGORY_MAP[category] || category;
      return await gplay.list({
        category: gplay.category[categoryEn.toUpperCase().replace(/ /g, '_')] || 'APPLICATION',
        collection: gplay.collection.TOP_FREE,
        country,
        num: limit
      });
    }
    return [];
  } catch (err) {
    console.error('Android 검색 실패:', err.message);
    return [];
  }
}

/**
 * 앱 이름/설명에서 키워드 추출
 */
function extractKeywords(name, description = '') {
  // 불용어 목록
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'app', 'apps', 'application', 'mobile', 'free',
    '앱', '어플', '무료', '최고', '최신', '인기', '추천', '-', '–', ':', '|'
  ]);

  // 이름에서 키워드 추출
  const nameWords = name
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopwords.has(w));

  // 설명에서 핵심 키워드 추출 (첫 100자)
  const descWords = description
    .slice(0, 100)
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
    .slice(0, 3);

  // 중복 제거, 최대 5개
  const keywords = [...new Set([...nameWords, ...descWords])].slice(0, 5);

  return keywords;
}

/**
 * 중복 제거 및 관련도 순 정렬
 */
function deduplicateAndRank(apps, targetApp) {
  const seen = new Set();
  const targetName = targetApp.name.toLowerCase();
  const targetKeywords = new Set(extractKeywords(targetApp.name, targetApp.description));

  const uniqueApps = apps.filter(app => {
    const id = app.appId || app.id;
    if (seen.has(id)) return false;
    // 자기 자신 제외
    if (app.title?.toLowerCase() === targetName || app.name?.toLowerCase() === targetName) {
      return false;
    }
    seen.add(id);
    return true;
  });

  // 관련도 점수 계산
  const scored = uniqueApps.map(app => {
    let score = 0;
    const appName = (app.title || app.name || '').toLowerCase();
    const appDesc = (app.description || app.summary || '').toLowerCase();

    // 같은 카테고리: +3점
    const appCategory = app.primaryGenre || app.genre || '';
    if (appCategory === targetApp.category ||
        CATEGORY_MAP_REVERSE[appCategory] === targetApp.category) {
      score += 3;
    }

    // 키워드 매칭: 키워드당 +2점
    targetKeywords.forEach(kw => {
      if (appName.includes(kw)) score += 2;
      if (appDesc.includes(kw)) score += 1;
    });

    // 평점 보너스 (4.0 이상)
    const rating = app.score || 0;
    if (rating >= 4.5) score += 2;
    else if (rating >= 4.0) score += 1;

    // 리뷰 수 보너스
    const reviews = app.reviews || 0;
    if (reviews >= 10000) score += 2;
    else if (reviews >= 1000) score += 1;

    return { ...app, relevanceScore: score };
  });

  // 점수순 정렬
  return scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * 비교 매트릭스 생성
 */
async function generateComparisonMatrix(targetApp, competitors) {
  // 공통 비교 항목
  const features = [
    { key: 'pricing', name: '가격 모델', extractor: extractPricing },
    { key: 'rating', name: '평점', extractor: extractRating },
    { key: 'reviews', name: '리뷰 수', extractor: extractReviews },
    { key: 'updates', name: '업데이트 빈도', extractor: extractUpdateFrequency },
    { key: 'size', name: '앱 크기', extractor: extractSize },
    { key: 'inAppPurchase', name: '인앱 구매', extractor: extractInAppPurchase },
    { key: 'ads', name: '광고', extractor: extractAds }
  ];

  const matrix = {
    features: features.map(f => f.name),
    target: {
      name: targetApp.name,
      values: features.map(f => f.extractor(targetApp))
    },
    competitors: competitors.map(comp => ({
      name: comp.title || comp.name,
      appId: comp.appId || comp.id,
      url: comp.url,
      values: features.map(f => f.extractor(comp))
    }))
  };

  return matrix;
}

// Feature extractors
function extractPricing(app) {
  if (app.free === false || app.price > 0) return '유료';
  if (app.offersIAP || app.offersIAP === undefined) return '프리미엄';
  return '무료';
}

function extractRating(app) {
  const score = app.score || 0;
  return score > 0 ? score.toFixed(1) : 'N/A';
}

function extractReviews(app) {
  const reviews = app.reviews || 0;
  if (reviews >= 1000000) return `${(reviews / 1000000).toFixed(1)}M`;
  if (reviews >= 1000) return `${(reviews / 1000).toFixed(1)}K`;
  return reviews.toString();
}

function extractUpdateFrequency(app) {
  const updated = app.updated || app.currentVersionReleaseDate;
  if (!updated) return 'N/A';

  const lastUpdate = new Date(updated);
  const daysSince = Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60 * 24));

  if (daysSince <= 30) return '활발';
  if (daysSince <= 90) return '보통';
  if (daysSince <= 180) return '저조';
  return '방치';
}

function extractSize(app) {
  const size = app.size || 0;
  if (typeof size === 'string') return size;
  if (size >= 1000000000) return `${(size / 1000000000).toFixed(1)}GB`;
  if (size >= 1000000) return `${(size / 1000000).toFixed(0)}MB`;
  return 'N/A';
}

function extractInAppPurchase(app) {
  if (app.offersIAP === true) return 'O';
  if (app.offersIAP === false) return 'X';
  return '?';
}

function extractAds(app) {
  // 광고 여부는 설명에서 추론
  const desc = (app.description || app.summary || '').toLowerCase();
  if (desc.includes('광고 없') || desc.includes('ad-free') || desc.includes('no ads')) {
    return 'X';
  }
  if (desc.includes('광고') || desc.includes('ads')) {
    return 'O';
  }
  return '?';
}

/**
 * 시장 갭 분석
 */
function identifyGaps(matrix) {
  const gaps = [];

  // 1. 가격 기회
  const pricingDistribution = {};
  matrix.competitors.forEach(c => {
    const pricing = c.values[0];
    pricingDistribution[pricing] = (pricingDistribution[pricing] || 0) + 1;
  });

  if (!pricingDistribution['무료'] || pricingDistribution['무료'] < 2) {
    gaps.push({
      type: 'pricing',
      insight: '대부분 유료/프리미엄 모델 → 무료 버전으로 시장 진입 기회',
      confidence: '[추론]'
    });
  }

  // 2. 평점 기회
  const avgRating = matrix.competitors
    .map(c => parseFloat(c.values[1]) || 0)
    .filter(r => r > 0)
    .reduce((a, b, _, arr) => a + b / arr.length, 0);

  if (avgRating < 4.0) {
    gaps.push({
      type: 'quality',
      insight: `경쟁앱 평균 평점 ${avgRating.toFixed(1)}점 → 품질 개선으로 차별화 가능`,
      confidence: '[확인됨]'
    });
  }

  // 3. 업데이트 기회
  const staleCount = matrix.competitors.filter(c =>
    c.values[3] === '저조' || c.values[3] === '방치'
  ).length;

  if (staleCount >= matrix.competitors.length / 2) {
    gaps.push({
      type: 'maintenance',
      insight: '경쟁앱 다수가 업데이트 저조 → 적극적인 유지보수로 신뢰 확보',
      confidence: '[추론]'
    });
  }

  // 4. 크기 기회
  const lightweightCount = matrix.competitors.filter(c => {
    const size = c.values[4];
    if (size === 'N/A') return false;
    const mb = parseInt(size);
    return mb < 50;
  }).length;

  if (lightweightCount < 2) {
    gaps.push({
      type: 'size',
      insight: '경량 앱 부재 → 가벼운 버전으로 저사양 기기 타겟 가능',
      confidence: '[추론]'
    });
  }

  // 5. 광고 기회
  const adFreeCount = matrix.competitors.filter(c => c.values[6] === 'X').length;
  if (adFreeCount < 2) {
    gaps.push({
      type: 'experience',
      insight: '광고 없는 앱 희소 → 프리미엄 광고 프리 경험으로 차별화',
      confidence: '[추론]'
    });
  }

  return gaps;
}

/**
 * 메인 함수: 경쟁앱 조사
 */
async function findCompetitors(app, options = {}) {
  const { platform = 'ios', limit = 5 } = options;

  console.log(`🔍 경쟁앱 조사 시작: ${app.name}`);
  console.log(`   카테고리: ${app.category}`);

  const searchFn = platform === 'ios' ? searchIOS : searchAndroid;
  const allApps = [];

  // 1. 같은 카테고리 Top 앱 수집
  console.log('   📊 카테고리 Top 앱 수집...');
  const categoryTop = await searchFn({
    category: app.category,
    country: 'kr',
    limit: 20
  });
  allApps.push(...categoryTop);
  await sleep(300);

  // 2. 키워드 기반 검색
  console.log('   🔑 키워드 검색...');
  const keywords = extractKeywords(app.name, app.description);
  console.log(`   키워드: ${keywords.join(', ')}`);

  for (const kw of keywords.slice(0, 3)) {
    const results = await searchFn({ term: kw, limit: 10 });
    allApps.push(...results);
    await sleep(200);
  }

  // 3. 중복 제거 및 관련도 순 정렬
  console.log('   📈 관련도 분석...');
  const ranked = deduplicateAndRank(allApps, app);

  // 4. 상위 N개 선정
  const competitors = ranked.slice(0, limit);
  console.log(`   ✅ 상위 ${competitors.length}개 경쟁앱 선정 완료`);

  // 5. 비교 매트릭스 생성
  console.log('   📋 비교 매트릭스 생성...');
  const matrix = await generateComparisonMatrix(app, competitors);

  // 6. 시장 갭 분석
  console.log('   🎯 시장 갭 분석...');
  const marketGap = identifyGaps(matrix);

  return {
    targetApp: app,
    competitors: competitors.map(c => ({
      name: c.title || c.name,
      developer: c.developer,
      appId: c.appId || c.id,
      url: c.url,
      rating: c.score,
      reviews: c.reviews,
      relevanceScore: c.relevanceScore
    })),
    matrix,
    marketGap,
    keywords
  };
}

/**
 * 결과 포맷팅 (마크다운)
 */
function formatAsMarkdown(result) {
  let md = `## 경쟁앱 분석: ${result.targetApp.name}\n\n`;

  // 경쟁앱 목록
  md += `### 주요 경쟁앱\n\n`;
  md += `| 순위 | 앱 이름 | 평점 | 리뷰 | 관련도 |\n`;
  md += `|------|---------|------|------|--------|\n`;
  result.competitors.forEach((c, i) => {
    md += `| ${i + 1} | ${c.name} | ${c.rating?.toFixed(1) || 'N/A'} | ${c.reviews || 'N/A'} | ${c.relevanceScore} |\n`;
  });

  // 비교 매트릭스
  md += `\n### 비교 매트릭스\n\n`;
  const header = ['기능', result.matrix.target.name, ...result.matrix.competitors.map(c => c.name)];
  md += `| ${header.join(' | ')} |\n`;
  md += `| ${header.map(() => '---').join(' | ')} |\n`;

  result.matrix.features.forEach((feature, i) => {
    const row = [
      feature,
      result.matrix.target.values[i],
      ...result.matrix.competitors.map(c => c.values[i])
    ];
    md += `| ${row.join(' | ')} |\n`;
  });

  // 시장 갭
  md += `\n### 시장 기회\n\n`;
  if (result.marketGap.length === 0) {
    md += `시장이 포화 상태입니다. 강력한 차별화가 필요합니다.\n`;
  } else {
    result.marketGap.forEach(gap => {
      md += `- ${gap.confidence} **${gap.type}**: ${gap.insight}\n`;
    });
  }

  return md;
}

/**
 * 결과 포맷팅 (JSON)
 */
function formatAsJSON(result) {
  return JSON.stringify(result, null, 2);
}

// CLI 실행 지원
if (require.main === module) {
  const testApp = {
    name: 'Flighty',
    category: '여행',
    description: '항공편 실시간 추적 앱'
  };

  findCompetitors(testApp, { platform: 'ios', limit: 5 })
    .then(result => {
      console.log('\n' + '='.repeat(60));
      console.log(formatAsMarkdown(result));
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = {
  findCompetitors,
  extractKeywords,
  deduplicateAndRank,
  generateComparisonMatrix,
  identifyGaps,
  formatAsMarkdown,
  formatAsJSON,
  searchIOS,
  searchAndroid
};
