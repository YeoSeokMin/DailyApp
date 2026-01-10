/**
 * feedbackCollector.js
 *
 * 사용자 피드백 수집 시스템
 * - 분석 결과에 대한 피드백 수집
 * - 피드백 분류 및 저장
 * - 피드백 통계 제공
 */

const fs = require('fs').promises;
const path = require('path');

const FEEDBACK_DIR = path.join(__dirname, 'data');
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, 'feedback_log.json');

// 피드백 카테고리
const FEEDBACK_CATEGORIES = {
  ACCURACY: 'accuracy',           // 정보 정확성 문제
  HALLUCINATION: 'hallucination', // 허위 정보 생성
  MISSING: 'missing',             // 누락된 정보
  OUTDATED: 'outdated',           // 오래된 정보
  FORMAT: 'format',               // 출력 형식 문제
  DEPTH: 'depth',                 // 분석 깊이 부족
  RELEVANCE: 'relevance',         // 관련성 낮음
  OTHER: 'other'                  // 기타
};

// 피드백 섹션 (어느 분석 영역에 대한 피드백인지)
const FEEDBACK_SECTIONS = {
  CORE: 'core',           // 기본 프로필
  BIZ: 'biz',             // 비즈니스 모델
  USER: 'user',           // 타겟 유저
  MARKET: 'market',       // 시장/경쟁
  GROWTH: 'growth',       // 성장 가능성
  INSIGHT: 'insight',     // 인사이트
  KOREA: 'korea',         // 한국 시장
  CATEGORY: 'category',   // 카테고리 특화
  OVERALL: 'overall'      // 전체
};

/**
 * 피드백 데이터 로드
 */
async function loadFeedback() {
  try {
    await fs.mkdir(FEEDBACK_DIR, { recursive: true });
    const data = await fs.readFile(FEEDBACK_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { feedbacks: [], stats: {}, lastUpdated: null };
  }
}

/**
 * 피드백 데이터 저장
 */
async function saveFeedback(data) {
  data.lastUpdated = new Date().toISOString();
  await fs.mkdir(FEEDBACK_DIR, { recursive: true });
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 피드백 수집
 * @param {Object} feedback
 * @param {string} feedback.appName - 분석 대상 앱 이름
 * @param {string} feedback.category - 피드백 카테고리 (FEEDBACK_CATEGORIES)
 * @param {string} feedback.section - 피드백 섹션 (FEEDBACK_SECTIONS)
 * @param {string} feedback.content - 피드백 내용
 * @param {string} feedback.expected - 기대했던 내용 (선택)
 * @param {string} feedback.actual - 실제 출력 내용 (선택)
 * @param {number} feedback.severity - 심각도 1-5 (5가 가장 심각)
 */
async function collectFeedback(feedback) {
  const data = await loadFeedback();

  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    appName: feedback.appName,
    category: feedback.category || FEEDBACK_CATEGORIES.OTHER,
    section: feedback.section || FEEDBACK_SECTIONS.OVERALL,
    content: feedback.content,
    expected: feedback.expected || null,
    actual: feedback.actual || null,
    severity: feedback.severity || 3,
    resolved: false,
    resolvedAt: null,
    appliedToPrompt: false
  };

  data.feedbacks.push(entry);

  // 통계 업데이트
  updateStats(data, entry);

  await saveFeedback(data);

  console.log(`✅ 피드백 수집 완료: [${entry.category}] ${entry.content.slice(0, 50)}...`);

  return entry;
}

/**
 * 통계 업데이트
 */
function updateStats(data, entry) {
  if (!data.stats.byCategory) data.stats.byCategory = {};
  if (!data.stats.bySection) data.stats.bySection = {};
  if (!data.stats.byApp) data.stats.byApp = {};

  // 카테고리별
  data.stats.byCategory[entry.category] = (data.stats.byCategory[entry.category] || 0) + 1;

  // 섹션별
  data.stats.bySection[entry.section] = (data.stats.bySection[entry.section] || 0) + 1;

  // 앱별
  if (entry.appName) {
    data.stats.byApp[entry.appName] = (data.stats.byApp[entry.appName] || 0) + 1;
  }

  // 전체 카운트
  data.stats.total = (data.stats.total || 0) + 1;
  data.stats.unresolved = data.feedbacks.filter(f => !f.resolved).length;
}

/**
 * 피드백 조회 (필터링)
 */
async function getFeedbacks(filters = {}) {
  const data = await loadFeedback();
  let feedbacks = data.feedbacks;

  if (filters.category) {
    feedbacks = feedbacks.filter(f => f.category === filters.category);
  }
  if (filters.section) {
    feedbacks = feedbacks.filter(f => f.section === filters.section);
  }
  if (filters.appName) {
    feedbacks = feedbacks.filter(f => f.appName === filters.appName);
  }
  if (filters.resolved !== undefined) {
    feedbacks = feedbacks.filter(f => f.resolved === filters.resolved);
  }
  if (filters.minSeverity) {
    feedbacks = feedbacks.filter(f => f.severity >= filters.minSeverity);
  }
  if (filters.since) {
    const sinceDate = new Date(filters.since);
    feedbacks = feedbacks.filter(f => new Date(f.timestamp) >= sinceDate);
  }

  return feedbacks;
}

/**
 * 피드백 해결 처리
 */
async function resolveFeedback(feedbackId, applied = false) {
  const data = await loadFeedback();
  const feedback = data.feedbacks.find(f => f.id === feedbackId);

  if (feedback) {
    feedback.resolved = true;
    feedback.resolvedAt = new Date().toISOString();
    feedback.appliedToPrompt = applied;
    data.stats.unresolved = data.feedbacks.filter(f => !f.resolved).length;
    await saveFeedback(data);
    return true;
  }
  return false;
}

/**
 * 통계 조회
 */
async function getStats() {
  const data = await loadFeedback();
  return data.stats;
}

/**
 * 반복 패턴 감지 (같은 이슈 N번 이상)
 */
async function detectPatterns(threshold = 3) {
  const data = await loadFeedback();
  const patterns = {};

  // 카테고리+섹션 조합으로 그룹핑
  data.feedbacks.forEach(f => {
    if (f.resolved) return;

    const key = `${f.category}:${f.section}`;
    if (!patterns[key]) {
      patterns[key] = {
        category: f.category,
        section: f.section,
        count: 0,
        feedbacks: [],
        keywords: []
      };
    }
    patterns[key].count++;
    patterns[key].feedbacks.push(f);

    // 키워드 추출
    const words = f.content.toLowerCase().split(/\s+/);
    patterns[key].keywords.push(...words);
  });

  // threshold 이상인 패턴만 반환
  const significantPatterns = Object.values(patterns)
    .filter(p => p.count >= threshold)
    .map(p => ({
      ...p,
      keywords: getMostFrequentWords(p.keywords, 5)
    }))
    .sort((a, b) => b.count - a.count);

  return significantPatterns;
}

/**
 * 가장 빈번한 단어 추출
 */
function getMostFrequentWords(words, limit) {
  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    '이', '가', '을', '를', '의', '에', '에서', '으로', '로', '와', '과', '도', '만',
    '앱', '분석', '결과', '정보', '내용']);

  const freq = {};
  words.forEach(w => {
    if (w.length > 1 && !stopwords.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

/**
 * ID 생성
 */
function generateId() {
  return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 빠른 피드백 수집 헬퍼
 */
const quickFeedback = {
  // 정보가 틀림
  inaccurate: (appName, section, content) => collectFeedback({
    appName,
    category: FEEDBACK_CATEGORIES.ACCURACY,
    section,
    content,
    severity: 4
  }),

  // AI가 지어냄
  hallucinated: (appName, section, content, actual) => collectFeedback({
    appName,
    category: FEEDBACK_CATEGORIES.HALLUCINATION,
    section,
    content,
    actual,
    severity: 5
  }),

  // 정보 누락
  missing: (appName, section, content, expected) => collectFeedback({
    appName,
    category: FEEDBACK_CATEGORIES.MISSING,
    section,
    content,
    expected,
    severity: 3
  }),

  // 분석이 얕음
  shallow: (appName, section, content) => collectFeedback({
    appName,
    category: FEEDBACK_CATEGORIES.DEPTH,
    section,
    content,
    severity: 2
  }),

  // 경쟁앱 정보 틀림
  wrongCompetitor: (appName, content, actual) => collectFeedback({
    appName,
    category: FEEDBACK_CATEGORIES.ACCURACY,
    section: FEEDBACK_SECTIONS.MARKET,
    content: `경쟁앱 정보 오류: ${content}`,
    actual,
    severity: 4
  })
};

// CLI 지원
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'stats') {
    getStats().then(stats => {
      console.log('\n📊 피드백 통계:');
      console.log(JSON.stringify(stats, null, 2));
    });
  } else if (command === 'patterns') {
    detectPatterns(3).then(patterns => {
      console.log('\n🔍 반복 패턴:');
      patterns.forEach(p => {
        console.log(`\n[${p.category}:${p.section}] ${p.count}회`);
        console.log(`  키워드: ${p.keywords.map(k => k.word).join(', ')}`);
      });
    });
  } else if (command === 'list') {
    getFeedbacks({ resolved: false }).then(feedbacks => {
      console.log(`\n📋 미해결 피드백 ${feedbacks.length}건:`);
      feedbacks.forEach(f => {
        console.log(`  [${f.id}] ${f.category}/${f.section}: ${f.content.slice(0, 50)}...`);
      });
    });
  } else {
    console.log('Usage: node feedbackCollector.js [stats|patterns|list]');
  }
}

module.exports = {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SECTIONS,
  collectFeedback,
  getFeedbacks,
  resolveFeedback,
  getStats,
  detectPatterns,
  quickFeedback
};
