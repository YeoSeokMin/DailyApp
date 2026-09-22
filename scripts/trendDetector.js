/**
 * trendDetector.js
 *
 * 트렌드 자동 감지 시스템
 * - 카테고리 트렌드
 * - 키워드/기능 트렌드
 * - 가격 모델 트렌드
 * - 기술 스택 트렌드
 * - AI 인사이트 생성
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const REPORTS_DIR = path.join(__dirname, '../web/data/reports');
const TRENDS_OUTPUT = path.join(__dirname, '../output/trends.json');

// 기술 스택 키워드
const TECH_KEYWORDS = {
  ai: ['AI', 'GPT', 'LLM', '인공지능', 'ML', '머신러닝', 'ChatGPT', 'Claude', '생성형'],
  ar_vr: ['AR', 'VR', '증강현실', '가상현실', 'XR', '메타버스', 'Vision Pro'],
  blockchain: ['블록체인', 'NFT', '암호화폐', '크립토', 'Web3', '토큰'],
  health: ['헬스케어', '디지털 헬스', '원격진료', '정신건강', '명상', '수면'],
  fintech: ['핀테크', '간편결제', '투자', '자산관리', '저축', '보험'],
  social: ['소셜', '커뮤니티', '매칭', '데이팅', '네트워킹'],
  productivity: ['생산성', '자동화', '노코드', '워크플로우', '협업', '일정'],
  creator: ['크리에이터', '편집', '영상', '콘텐츠', '스트리밍', '유튜브'],
  subscription: ['구독', '멤버십', '프리미엄', '프로', '플러스']
};

// 가격 모델 키워드
const PRICING_KEYWORDS = {
  free: ['무료', 'free', '광고 지원'],
  freemium: ['프리미엄', 'freemium', '인앱 구매', 'IAP', '부분 유료'],
  subscription: ['구독', 'subscription', '월간', '연간', '/월', '/년'],
  onetime: ['유료', '일회성', '단건', '구매']
};

/**
 * 리포트 파일 로드
 */
async function loadReports(options = {}) {
  const { days = 7, offset = 0 } = options;

  try {
    const files = await fs.readdir(REPORTS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();

    const startIndex = offset;
    const endIndex = offset + days;
    const targetFiles = jsonFiles.slice(startIndex, endIndex);

    const reports = [];
    for (const file of targetFiles) {
      try {
        const content = await fs.readFile(path.join(REPORTS_DIR, file), 'utf8');
        const report = JSON.parse(content);
        reports.push({
          date: file.replace('.json', ''),
          ...report
        });
      } catch (e) {
        console.warn(`파일 로드 실패: ${file}`);
      }
    }

    return reports;
  } catch (err) {
    console.error('리포트 로드 실패:', err.message);
    return [];
  }
}

/**
 * 분석 데이터 추출
 */
function extractAnalyses(reports) {
  const analyses = [];

  reports.forEach(report => {
    // iOS 앱
    if (report.ios) {
      report.ios.forEach(app => {
        analyses.push({
          ...app,
          platform: 'ios',
          date: report.date
        });
      });
    }

    // Android 앱
    if (report.android) {
      report.android.forEach(app => {
        analyses.push({
          ...app,
          platform: 'android',
          date: report.date
        });
      });
    }
  });

  return analyses;
}

/**
 * 카테고리별 집계
 */
function aggregateByCategory(analyses) {
  const stats = {};

  analyses.forEach(app => {
    const category = app.category || '기타';

    if (!stats[category]) {
      stats[category] = {
        count: 0,
        apps: [],
        avgScore: 0,
        scores: []
      };
    }

    stats[category].count++;
    stats[category].apps.push(app.name);

    if (app.scores?.overall) {
      stats[category].scores.push(app.scores.overall);
    }
  });

  // 평균 점수 계산
  Object.values(stats).forEach(stat => {
    if (stat.scores.length > 0) {
      stat.avgScore = stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length;
    }
  });

  return stats;
}

/**
 * 기간 대비 변화 계산
 */
function calculateChanges(currentStats, previousStats) {
  const changes = [];

  Object.entries(currentStats).forEach(([category, current]) => {
    const previous = previousStats[category] || { count: 0 };

    const changePercent = previous.count > 0
      ? ((current.count - previous.count) / previous.count) * 100
      : current.count > 0 ? 100 : 0;

    changes.push({
      category,
      currentCount: current.count,
      previousCount: previous.count,
      changePercent: Math.round(changePercent),
      changeDirection: changePercent > 10 ? 'up' : changePercent < -10 ? 'down' : 'stable',
      apps: current.apps,
      avgScore: current.avgScore
    });
  });

  return changes.sort((a, b) => b.changePercent - a.changePercent);
}

/**
 * 핫 키워드 추출
 */
function extractHotKeywords(analyses) {
  const keywordCount = {};

  analyses.forEach(app => {
    // 앱 이름, 설명, 분석에서 키워드 추출
    const text = [
      app.name,
      app.idea_summary,
      app.analysis?.problem,
      app.analysis?.solution,
      app.analysis?.unique_point,
      app.verdict
    ].filter(Boolean).join(' ').toLowerCase();

    // 사전 정의된 키워드 매칭
    Object.entries(TECH_KEYWORDS).forEach(([category, keywords]) => {
      keywords.forEach(kw => {
        if (text.includes(kw.toLowerCase())) {
          if (!keywordCount[kw]) {
            keywordCount[kw] = { keyword: kw, category, count: 0, apps: [] };
          }
          keywordCount[kw].count++;
          if (!keywordCount[kw].apps.includes(app.name)) {
            keywordCount[kw].apps.push(app.name);
          }
        }
      });
    });

    // 태그에서 추출
    if (app.tags) {
      app.tags.forEach(tag => {
        const cleanTag = tag.replace('#', '');
        if (!keywordCount[cleanTag]) {
          keywordCount[cleanTag] = { keyword: cleanTag, category: 'tag', count: 0, apps: [] };
        }
        keywordCount[cleanTag].count++;
        if (!keywordCount[cleanTag].apps.includes(app.name)) {
          keywordCount[cleanTag].apps.push(app.name);
        }
      });
    }
  });

  // 정렬 및 상위 추출
  return Object.values(keywordCount)
    .filter(k => k.count >= 2) // 최소 2회 이상
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * 가격 트렌드 분석
 */
function analyzePricingTrends(analyses) {
  const pricingStats = {
    free: { count: 0, apps: [] },
    freemium: { count: 0, apps: [] },
    subscription: { count: 0, apps: [] },
    onetime: { count: 0, apps: [] },
    unknown: { count: 0, apps: [] }
  };

  analyses.forEach(app => {
    const text = [
      app.business?.monetization,
      app.business?.pricing_suggestion
    ].filter(Boolean).join(' ').toLowerCase();

    let categorized = false;

    Object.entries(PRICING_KEYWORDS).forEach(([model, keywords]) => {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        pricingStats[model].count++;
        pricingStats[model].apps.push(app.name);
        categorized = true;
      }
    });

    if (!categorized) {
      pricingStats.unknown.count++;
    }
  });

  const total = analyses.length;
  const distribution = {};

  Object.entries(pricingStats).forEach(([model, stats]) => {
    distribution[model] = {
      count: stats.count,
      percent: total > 0 ? Math.round((stats.count / total) * 100) : 0,
      examples: stats.apps.slice(0, 3)
    };
  });

  // 지배적 모델 찾기
  const dominant = Object.entries(distribution)
    .filter(([model]) => model !== 'unknown')
    .sort((a, b) => b[1].count - a[1].count)[0];

  return {
    distribution,
    dominant: dominant ? { model: dominant[0], ...dominant[1] } : null,
    insight: generatePricingInsight(distribution)
  };
}

/**
 * 가격 인사이트 생성
 */
function generatePricingInsight(distribution) {
  const { subscription, freemium, free } = distribution;

  if (subscription.percent > 40) {
    return '구독 모델이 주류. 안정적 수익을 위한 구독 전환 전략이 중요.';
  }
  if (freemium.percent > 50) {
    return '프리미엄 모델 대세. 무료 사용자 → 유료 전환 퍼널 설계가 핵심.';
  }
  if (free.percent > 40) {
    return '무료 앱 비중 높음. 광고 또는 데이터 기반 수익화 고려.';
  }
  return '다양한 가격 모델 혼재. 타겟 사용자에 맞는 모델 선택 필요.';
}

/**
 * 기술 트렌드 분석
 */
function analyzeTechTrends(analyses) {
  const techStats = {};

  Object.keys(TECH_KEYWORDS).forEach(tech => {
    techStats[tech] = { count: 0, apps: [], examples: [] };
  });

  analyses.forEach(app => {
    const text = [
      app.name,
      app.idea_summary,
      app.analysis?.solution,
      app.dev_insight?.tech_stack?.join(' '),
      app.verdict
    ].filter(Boolean).join(' ').toLowerCase();

    Object.entries(TECH_KEYWORDS).forEach(([tech, keywords]) => {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        techStats[tech].count++;
        techStats[tech].apps.push(app.name);
      }
    });
  });

  // 상위 기술 트렌드
  const topTrends = Object.entries(techStats)
    .map(([tech, stats]) => ({
      tech,
      count: stats.count,
      percent: Math.round((stats.count / analyses.length) * 100),
      apps: stats.apps.slice(0, 5)
    }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    trends: topTrends,
    dominant: topTrends[0] || null,
    emerging: topTrends.filter(t => t.percent >= 10 && t.percent < 30)
  };
}

/**
 * 기회 영역 감지
 */
function detectOpportunities(changes, techTrends, pricingTrends) {
  const opportunities = [];

  // 급상승 카테고리 + 낮은 경쟁
  changes
    .filter(c => c.changePercent > 30 && c.currentCount < 5)
    .forEach(c => {
      opportunities.push({
        type: 'rising_category',
        title: `${c.category} 카테고리 급부상`,
        description: `${c.changePercent}% 증가했지만 앱 수가 적어 진입 기회`,
        confidence: 'high',
        category: c.category
      });
    });

  // AI 관련 기회
  const aiTrend = techTrends.trends.find(t => t.tech === 'ai');
  if (aiTrend && aiTrend.percent > 20) {
    opportunities.push({
      type: 'tech_trend',
      title: 'AI 기능 통합 트렌드',
      description: `${aiTrend.percent}%의 앱이 AI 기능 포함. AI 미적용 카테고리에서 차별화 기회`,
      confidence: 'high',
      tech: 'ai'
    });
  }

  // 구독 모델 기회
  if (pricingTrends.distribution.subscription.percent < 30) {
    opportunities.push({
      type: 'pricing',
      title: '구독 모델 도입 기회',
      description: '구독 모델 채택률이 낮음. 안정적 수익을 위한 구독 전환 고려',
      confidence: 'medium'
    });
  }

  return opportunities;
}

/**
 * CLI로 Claude 호출
 */
function callClaudeCLI(prompt) {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--model', 'claude-sonnet-4-6', '--print'], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', data => stdout += data.toString());
    claude.stderr.on('data', data => stderr += data.toString());

    claude.on('close', code => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude CLI 실패: ${stderr}`));
      }
    });

    claude.on('error', reject);
    claude.stdin.write(prompt);
    claude.stdin.end();

    // 3분 타임아웃
    setTimeout(() => {
      claude.kill();
      reject(new Error('CLI 타임아웃'));
    }, 180000);
  });
}

/**
 * AI 인사이트 생성
 */
async function generateTrendInsight(trends, analyses) {
  const prompt = `
다음 앱 트렌드 데이터를 분석해서 인디 개발자를 위한 인사이트를 생성해주세요.

## 데이터

### 급상승 카테고리 (이전 대비 변화율)
${trends.risingCategories.slice(0, 5).map(c =>
  `- ${c.category}: ${c.changePercent > 0 ? '+' : ''}${c.changePercent}% (${c.currentCount}개 앱)`
).join('\n')}

### 핫 키워드/기능
${trends.hotKeywords.slice(0, 10).map(k =>
  `- ${k.keyword}: ${k.count}회 (카테고리: ${k.category})`
).join('\n')}

### 가격 모델 분포
${Object.entries(trends.pricingTrends.distribution)
  .filter(([m]) => m !== 'unknown')
  .map(([model, data]) => `- ${model}: ${data.percent}%`)
  .join('\n')}

### 기술 트렌드
${trends.techTrends.trends.slice(0, 5).map(t =>
  `- ${t.tech}: ${t.percent}% (${t.count}개 앱)`
).join('\n')}

### 감지된 기회
${trends.opportunities.map(o => `- ${o.title}: ${o.description}`).join('\n')}

## 출력 형식 (JSON)
{
  "trend_summary": "2-3문장 트렌드 요약",
  "trend_details": ["트렌드1", "트렌드2", "트렌드3"],
  "hot_categories": ["카테고리1", "카테고리2"],
  "opportunity": "가장 유망한 기회 영역 (1문장)",
  "action_item": "인디 개발자가 당장 할 수 있는 구체적 액션 (1문장)",
  "weekly_theme": "이번 주 테마 키워드 (2-3단어)"
}

JSON만 출력하세요.`;

  try {
    let text;

    if (process.env.ANTHROPIC_API_KEY) {
      // API 모드
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });
      text = response.content[0].text;
    } else {
      // CLI 모드
      console.log('  📟 CLI 모드로 인사이트 생성 중...');
      text = await callClaudeCLI(prompt);
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('AI 인사이트 생성 실패:', err.message);
  }

  // 폴백: 규칙 기반 인사이트
  return generateFallbackInsight(trends);
}

/**
 * 폴백 인사이트 (AI 실패 시)
 */
function generateFallbackInsight(trends) {
  const topCategory = trends.risingCategories[0];
  const topKeyword = trends.hotKeywords[0];
  const topTech = trends.techTrends.dominant;

  return {
    trend_summary: topCategory
      ? `${topCategory.category} 카테고리가 ${topCategory.changePercent}% 급상승. ${topTech?.tech || 'AI'} 기술 적용 앱이 증가 중.`
      : '전반적으로 안정적인 추세. 특정 카테고리의 급격한 변화 없음.',
    trend_details: [
      topCategory ? `${topCategory.category} 카테고리 관심 급증` : '카테고리별 균형 유지',
      topKeyword ? `'${topKeyword.keyword}' 키워드 인기` : '다양한 키워드 분포',
      topTech ? `${topTech.tech} 기술 트렌드 지속` : '기술 다양화'
    ],
    hot_categories: trends.risingCategories.slice(0, 2).map(c => c.category),
    opportunity: trends.opportunities[0]?.description || '니치 시장에서 차별화된 UX 제공',
    action_item: topTech?.tech === 'ai'
      ? 'AI 기능을 기존 앱에 통합하여 차별화'
      : '사용자 피드백 기반 핵심 기능 개선',
    weekly_theme: topKeyword?.keyword || '사용자 경험'
  };
}

/**
 * 메인: 트렌드 감지
 */
async function detectTrends(period = 7) {
  console.log(`📊 트렌드 분석 시작 (최근 ${period}일)`);

  // 1. 데이터 로드
  console.log('  📂 리포트 로드 중...');
  const currentReports = await loadReports({ days: period, offset: 0 });
  const previousReports = await loadReports({ days: period, offset: period });

  if (currentReports.length === 0) {
    console.log('  ⚠️ 분석할 데이터가 없습니다.');
    return null;
  }

  console.log(`  ✅ 현재 기간: ${currentReports.length}개 리포트`);
  console.log(`  ✅ 이전 기간: ${previousReports.length}개 리포트`);

  // 2. 분석 데이터 추출
  const currentAnalyses = extractAnalyses(currentReports);
  const previousAnalyses = extractAnalyses(previousReports);

  console.log(`  📱 현재 기간 앱: ${currentAnalyses.length}개`);

  // 3. 카테고리 집계
  console.log('  📊 카테고리 분석 중...');
  const currentStats = aggregateByCategory(currentAnalyses);
  const previousStats = aggregateByCategory(previousAnalyses);
  const changes = calculateChanges(currentStats, previousStats);

  // 4. 트렌드 분석
  console.log('  🔥 트렌드 감지 중...');
  const trends = {
    period: {
      current: `최근 ${period}일`,
      previous: `${period}-${period * 2}일 전`
    },
    risingCategories: changes.filter(c => c.changeDirection === 'up'),
    decliningCategories: changes.filter(c => c.changeDirection === 'down'),
    stableCategories: changes.filter(c => c.changeDirection === 'stable'),
    hotKeywords: extractHotKeywords(currentAnalyses),
    pricingTrends: analyzePricingTrends(currentAnalyses),
    techTrends: analyzeTechTrends(currentAnalyses),
    opportunities: []
  };

  // 5. 기회 영역 감지
  trends.opportunities = detectOpportunities(
    changes,
    trends.techTrends,
    trends.pricingTrends
  );

  // 6. AI 인사이트 생성
  console.log('  🤖 AI 인사이트 생성 중...');
  const insight = await generateTrendInsight(trends, currentAnalyses);

  const result = {
    generatedAt: new Date().toISOString(),
    ...trends,
    insight
  };

  // 7. 결과 저장
  await fs.mkdir(path.dirname(TRENDS_OUTPUT), { recursive: true });
  await fs.writeFile(TRENDS_OUTPUT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`  💾 저장: ${TRENDS_OUTPUT}`);

  return result;
}

/**
 * 트렌드 리포트 생성 (마크다운)
 */
function generateTrendReport(trends) {
  if (!trends) return '트렌드 데이터가 없습니다.';

  let md = `# 주간 트렌드 리포트\n\n`;
  md += `생성: ${new Date(trends.generatedAt).toLocaleString('ko-KR')}\n\n`;

  // 핵심 인사이트
  md += `## 이번 주 테마: ${trends.insight.weekly_theme}\n\n`;
  md += `> ${trends.insight.trend_summary}\n\n`;

  // 급상승 카테고리
  md += `## 🚀 급상승 카테고리\n\n`;
  if (trends.risingCategories.length > 0) {
    md += `| 카테고리 | 변화율 | 앱 수 |\n`;
    md += `|---------|--------|-------|\n`;
    trends.risingCategories.slice(0, 5).forEach(c => {
      md += `| ${c.category} | +${c.changePercent}% | ${c.currentCount} |\n`;
    });
  } else {
    md += `특별히 급상승한 카테고리가 없습니다.\n`;
  }
  md += `\n`;

  // 핫 키워드
  md += `## 🔥 핫 키워드\n\n`;
  trends.hotKeywords.slice(0, 10).forEach((k, i) => {
    md += `${i + 1}. **${k.keyword}** (${k.count}회) - ${k.apps.slice(0, 2).join(', ')}\n`;
  });
  md += `\n`;

  // 기술 트렌드
  md += `## 💻 기술 트렌드\n\n`;
  trends.techTrends.trends.slice(0, 5).forEach(t => {
    const bar = '█'.repeat(Math.round(t.percent / 5));
    md += `- **${t.tech}**: ${bar} ${t.percent}%\n`;
  });
  md += `\n`;

  // 가격 모델
  md += `## 💰 가격 모델 분포\n\n`;
  Object.entries(trends.pricingTrends.distribution)
    .filter(([m]) => m !== 'unknown')
    .forEach(([model, data]) => {
      md += `- ${model}: ${data.percent}%\n`;
    });
  md += `\n> ${trends.pricingTrends.insight}\n\n`;

  // 기회 영역
  md += `## 🎯 기회 영역\n\n`;
  trends.opportunities.forEach(o => {
    md += `### ${o.title}\n`;
    md += `${o.description}\n\n`;
  });

  // 액션 아이템
  md += `## ✅ 이번 주 액션\n\n`;
  md += `> ${trends.insight.action_item}\n`;

  return md;
}

// CLI 지원
if (require.main === module) {
  const args = process.argv.slice(2);
  const period = parseInt(args[0]) || 7;

  detectTrends(period)
    .then(trends => {
      if (trends) {
        console.log('\n' + '='.repeat(50));
        console.log(generateTrendReport(trends));
      }
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = {
  detectTrends,
  extractHotKeywords,
  analyzePricingTrends,
  analyzeTechTrends,
  detectOpportunities,
  generateTrendReport,
  loadReports
};
