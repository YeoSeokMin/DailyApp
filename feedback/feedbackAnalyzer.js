/**
 * feedbackAnalyzer.js
 *
 * 피드백 분석 엔진
 * - 패턴 분석
 * - 심각도 우선순위화
 * - 개선 제안 생성
 * - 트렌드 분석
 */

const { getFeedbacks, detectPatterns, FEEDBACK_CATEGORIES, FEEDBACK_SECTIONS } = require('./feedbackCollector');

// 섹션 → 프롬프트 모듈 매핑
const SECTION_TO_MODULE = {
  [FEEDBACK_SECTIONS.CORE]: 'core.txt',
  [FEEDBACK_SECTIONS.BIZ]: 'biz.txt',
  [FEEDBACK_SECTIONS.USER]: 'user.txt',
  [FEEDBACK_SECTIONS.MARKET]: 'market.txt',
  [FEEDBACK_SECTIONS.GROWTH]: 'growth.txt',
  [FEEDBACK_SECTIONS.INSIGHT]: 'output-md.txt',
  [FEEDBACK_SECTIONS.KOREA]: 'korea.txt',
  [FEEDBACK_SECTIONS.CATEGORY]: null, // 동적 결정
  [FEEDBACK_SECTIONS.OVERALL]: 'base.txt'
};

// 카테고리별 기본 개선 템플릿
const IMPROVEMENT_TEMPLATES = {
  [FEEDBACK_CATEGORIES.ACCURACY]: {
    prefix: '⚠️ 정확성 주의',
    instruction: '반드시 공식 출처에서 확인 후 작성. 확신 없으면 [추측] 태그 사용.'
  },
  [FEEDBACK_CATEGORIES.HALLUCINATION]: {
    prefix: '🚫 허위 정보 금지',
    instruction: '존재하지 않는 앱/기능/수치 생성 금지. 모르면 "정보 없음" 표기.'
  },
  [FEEDBACK_CATEGORIES.MISSING]: {
    prefix: '📝 필수 정보',
    instruction: '해당 항목은 반드시 포함. 누락 시 불완전 분석으로 간주.'
  },
  [FEEDBACK_CATEGORIES.OUTDATED]: {
    prefix: '🕐 최신 정보',
    instruction: '최신 버전/현재 상태 기준으로 작성. 과거 정보는 명시적으로 구분.'
  },
  [FEEDBACK_CATEGORIES.FORMAT]: {
    prefix: '📋 형식 준수',
    instruction: '지정된 출력 형식을 정확히 따를 것.'
  },
  [FEEDBACK_CATEGORIES.DEPTH]: {
    prefix: '🔍 심층 분석 필요',
    instruction: '표면적 분석 지양. 구체적 근거와 수치 포함.'
  },
  [FEEDBACK_CATEGORIES.RELEVANCE]: {
    prefix: '🎯 관련성',
    instruction: '분석 대상과 직접 관련된 정보만 포함.'
  }
};

/**
 * 피드백 분석 리포트 생성
 */
async function generateAnalysisReport() {
  const allFeedbacks = await getFeedbacks();
  const unresolvedFeedbacks = await getFeedbacks({ resolved: false });
  const patterns = await detectPatterns(3);

  const report = {
    summary: {
      total: allFeedbacks.length,
      unresolved: unresolvedFeedbacks.length,
      resolvedRate: allFeedbacks.length > 0
        ? ((allFeedbacks.length - unresolvedFeedbacks.length) / allFeedbacks.length * 100).toFixed(1)
        : 0
    },
    topIssues: await getTopIssues(unresolvedFeedbacks),
    patterns: patterns,
    sectionHealth: await analyzeSectionHealth(unresolvedFeedbacks),
    recommendations: await generateRecommendations(patterns, unresolvedFeedbacks),
    trends: await analyzeTrends(allFeedbacks)
  };

  return report;
}

/**
 * 가장 심각한 이슈 추출
 */
async function getTopIssues(feedbacks, limit = 5) {
  return feedbacks
    .sort((a, b) => {
      // 심각도 우선, 같으면 최신순
      if (b.severity !== a.severity) return b.severity - a.severity;
      return new Date(b.timestamp) - new Date(a.timestamp);
    })
    .slice(0, limit)
    .map(f => ({
      id: f.id,
      category: f.category,
      section: f.section,
      content: f.content,
      severity: f.severity,
      appName: f.appName,
      timestamp: f.timestamp
    }));
}

/**
 * 섹션별 건강도 분석
 */
async function analyzeSectionHealth(feedbacks) {
  const sectionStats = {};

  Object.values(FEEDBACK_SECTIONS).forEach(section => {
    sectionStats[section] = {
      total: 0,
      avgSeverity: 0,
      categories: {}
    };
  });

  feedbacks.forEach(f => {
    const section = f.section || FEEDBACK_SECTIONS.OVERALL;
    sectionStats[section].total++;

    if (!sectionStats[section].categories[f.category]) {
      sectionStats[section].categories[f.category] = 0;
    }
    sectionStats[section].categories[f.category]++;
  });

  // 평균 심각도 계산
  Object.keys(sectionStats).forEach(section => {
    const sectionFeedbacks = feedbacks.filter(f => f.section === section);
    if (sectionFeedbacks.length > 0) {
      sectionStats[section].avgSeverity =
        sectionFeedbacks.reduce((sum, f) => sum + f.severity, 0) / sectionFeedbacks.length;
    }
  });

  // 건강도 점수 계산 (0-100, 높을수록 좋음)
  Object.keys(sectionStats).forEach(section => {
    const stats = sectionStats[section];
    // 피드백 없으면 100점, 있으면 심각도 기반 감점
    stats.healthScore = stats.total === 0
      ? 100
      : Math.max(0, 100 - (stats.total * 10) - (stats.avgSeverity * 5));
  });

  return sectionStats;
}

/**
 * 개선 제안 생성
 */
async function generateRecommendations(patterns, feedbacks) {
  const recommendations = [];

  // 1. 패턴 기반 제안
  patterns.forEach(pattern => {
    const template = IMPROVEMENT_TEMPLATES[pattern.category];
    const targetModule = SECTION_TO_MODULE[pattern.section];

    recommendations.push({
      type: 'pattern',
      priority: pattern.count >= 5 ? 'critical' : 'high',
      category: pattern.category,
      section: pattern.section,
      targetModule: targetModule,
      issue: `${pattern.category} 이슈 ${pattern.count}회 반복`,
      keywords: pattern.keywords.map(k => k.word),
      suggestion: template ? {
        prefix: template.prefix,
        instruction: template.instruction,
        context: pattern.keywords.map(k => k.word).join(', ')
      } : null,
      feedbackIds: pattern.feedbacks.map(f => f.id)
    });
  });

  // 2. 심각도 기반 제안 (개별 심각한 피드백)
  const criticalFeedbacks = feedbacks.filter(f => f.severity >= 4);
  const criticalBySection = {};

  criticalFeedbacks.forEach(f => {
    if (!criticalBySection[f.section]) {
      criticalBySection[f.section] = [];
    }
    criticalBySection[f.section].push(f);
  });

  Object.entries(criticalBySection).forEach(([section, sectionFeedbacks]) => {
    if (sectionFeedbacks.length >= 2) {
      recommendations.push({
        type: 'critical',
        priority: 'critical',
        section: section,
        targetModule: SECTION_TO_MODULE[section],
        issue: `${section} 섹션에 심각한 이슈 ${sectionFeedbacks.length}건`,
        suggestion: {
          prefix: '🔴 긴급 수정 필요',
          instruction: sectionFeedbacks.map(f => f.content).join('; ')
        },
        feedbackIds: sectionFeedbacks.map(f => f.id)
      });
    }
  });

  // 우선순위 정렬
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * 트렌드 분석 (시간에 따른 변화)
 */
async function analyzeTrends(feedbacks) {
  if (feedbacks.length < 5) {
    return { status: 'insufficient_data', message: '트렌드 분석을 위한 데이터 부족' };
  }

  // 최근 7일 vs 이전 7일 비교
  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const recentFeedbacks = feedbacks.filter(f =>
    new Date(f.timestamp) >= oneWeekAgo
  );
  const previousFeedbacks = feedbacks.filter(f =>
    new Date(f.timestamp) >= twoWeeksAgo && new Date(f.timestamp) < oneWeekAgo
  );

  const recentCount = recentFeedbacks.length;
  const previousCount = previousFeedbacks.length;

  let trend = 'stable';
  let changePercent = 0;

  if (previousCount > 0) {
    changePercent = ((recentCount - previousCount) / previousCount * 100).toFixed(1);
    if (changePercent > 20) trend = 'increasing';
    else if (changePercent < -20) trend = 'decreasing';
  }

  // 카테고리별 트렌드
  const categoryTrends = {};
  Object.values(FEEDBACK_CATEGORIES).forEach(cat => {
    const recentCat = recentFeedbacks.filter(f => f.category === cat).length;
    const prevCat = previousFeedbacks.filter(f => f.category === cat).length;
    categoryTrends[cat] = {
      recent: recentCat,
      previous: prevCat,
      trend: recentCat > prevCat ? '↑' : recentCat < prevCat ? '↓' : '→'
    };
  });

  return {
    status: 'analyzed',
    overall: {
      trend,
      changePercent: parseFloat(changePercent),
      recentCount,
      previousCount
    },
    byCategory: categoryTrends,
    insight: generateTrendInsight(trend, changePercent, categoryTrends)
  };
}

/**
 * 트렌드 인사이트 생성
 */
function generateTrendInsight(trend, changePercent, categoryTrends) {
  let insight = '';

  if (trend === 'increasing') {
    insight = `⚠️ 피드백이 ${changePercent}% 증가 중. `;

    // 가장 증가한 카테고리 찾기
    const increasingCats = Object.entries(categoryTrends)
      .filter(([_, v]) => v.trend === '↑')
      .sort((a, b) => (b[1].recent - b[1].previous) - (a[1].recent - a[1].previous));

    if (increasingCats.length > 0) {
      insight += `특히 ${increasingCats[0][0]} 이슈가 증가하고 있습니다.`;
    }
  } else if (trend === 'decreasing') {
    insight = `✅ 피드백이 ${Math.abs(changePercent)}% 감소. 품질이 개선되고 있습니다.`;
  } else {
    insight = '📊 피드백 추세가 안정적입니다.';
  }

  return insight;
}

/**
 * 특정 섹션에 대한 상세 분석
 */
async function analyzeSection(section) {
  const feedbacks = await getFeedbacks({ section, resolved: false });

  if (feedbacks.length === 0) {
    return {
      section,
      status: 'healthy',
      message: '해당 섹션에 미해결 피드백이 없습니다.'
    };
  }

  const analysis = {
    section,
    targetModule: SECTION_TO_MODULE[section],
    totalFeedbacks: feedbacks.length,
    avgSeverity: feedbacks.reduce((sum, f) => sum + f.severity, 0) / feedbacks.length,
    categories: {},
    topIssues: feedbacks.slice(0, 5).map(f => ({
      content: f.content,
      severity: f.severity,
      appName: f.appName
    })),
    suggestedFixes: []
  };

  // 카테고리 분포
  feedbacks.forEach(f => {
    analysis.categories[f.category] = (analysis.categories[f.category] || 0) + 1;
  });

  // 수정 제안 생성
  Object.entries(analysis.categories).forEach(([category, count]) => {
    if (count >= 2) {
      const template = IMPROVEMENT_TEMPLATES[category];
      if (template) {
        analysis.suggestedFixes.push({
          category,
          count,
          fix: `${template.prefix}: ${template.instruction}`
        });
      }
    }
  });

  return analysis;
}

/**
 * 마크다운 리포트 생성
 */
async function generateMarkdownReport() {
  const report = await generateAnalysisReport();

  let md = `# 피드백 분석 리포트\n\n`;
  md += `생성 시간: ${new Date().toLocaleString('ko-KR')}\n\n`;

  // 요약
  md += `## 📊 요약\n\n`;
  md += `| 항목 | 값 |\n|------|----|\n`;
  md += `| 총 피드백 | ${report.summary.total}건 |\n`;
  md += `| 미해결 | ${report.summary.unresolved}건 |\n`;
  md += `| 해결률 | ${report.summary.resolvedRate}% |\n\n`;

  // Top 이슈
  md += `## 🔥 주요 이슈\n\n`;
  report.topIssues.forEach((issue, i) => {
    md += `${i + 1}. **[${issue.category}/${issue.section}]** ${issue.content}\n`;
    md += `   - 심각도: ${'⭐'.repeat(issue.severity)}\n`;
    md += `   - 앱: ${issue.appName || 'N/A'}\n\n`;
  });

  // 패턴
  if (report.patterns.length > 0) {
    md += `## 🔄 반복 패턴\n\n`;
    report.patterns.forEach(p => {
      md += `### ${p.category}/${p.section} (${p.count}회)\n`;
      md += `- 키워드: ${p.keywords.map(k => k.word).join(', ')}\n\n`;
    });
  }

  // 개선 제안
  if (report.recommendations.length > 0) {
    md += `## 💡 개선 제안\n\n`;
    report.recommendations.forEach((rec, i) => {
      const priorityIcon = rec.priority === 'critical' ? '🔴' : '🟡';
      md += `${i + 1}. ${priorityIcon} **${rec.issue}**\n`;
      md += `   - 대상 모듈: \`${rec.targetModule || 'N/A'}\`\n`;
      if (rec.suggestion) {
        md += `   - 제안: ${rec.suggestion.prefix} - ${rec.suggestion.instruction}\n`;
      }
      md += `\n`;
    });
  }

  // 트렌드
  if (report.trends.status === 'analyzed') {
    md += `## 📈 트렌드\n\n`;
    md += `${report.trends.insight}\n\n`;
  }

  return md;
}

// CLI 지원
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'report') {
    generateMarkdownReport().then(md => console.log(md));
  } else if (command === 'section') {
    const section = args[1] || 'market';
    analyzeSection(section).then(analysis => {
      console.log(JSON.stringify(analysis, null, 2));
    });
  } else if (command === 'recommendations') {
    generateAnalysisReport().then(report => {
      console.log('\n💡 개선 제안:\n');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.priority}] ${rec.issue}`);
        if (rec.suggestion) {
          console.log(`   → ${rec.suggestion.prefix}: ${rec.suggestion.instruction}`);
        }
        console.log(`   대상: ${rec.targetModule}\n`);
      });
    });
  } else {
    console.log('Usage: node feedbackAnalyzer.js [report|section <name>|recommendations]');
  }
}

module.exports = {
  generateAnalysisReport,
  getTopIssues,
  analyzeSectionHealth,
  generateRecommendations,
  analyzeTrends,
  analyzeSection,
  generateMarkdownReport,
  SECTION_TO_MODULE
};
