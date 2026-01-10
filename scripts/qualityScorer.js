/**
 * qualityScorer.js
 *
 * 분석 품질 점수 시스템
 * - Confidence 분포 평가
 * - 완성도 체크
 * - 구체성 측정
 * - 실행가능성 평가
 */

// 필수 섹션 정의 (prompt.txt 출력 구조에 맞춤)
const REQUIRED_SECTIONS = {
  markdown: [
    '한줄 요약',
    '기본 프로필',
    '비즈니스 모델',
    '타겟 유저',
    '시장 포지션',
    '성장 가능성',
    '핵심 인사이트'
  ],
  json: [
    'date',
    'ios',
    'android',
    'daily_insight'
  ]
};

// 구체성 지표 (숫자, 퍼센트, 금액 등)
const SPECIFICITY_PATTERNS = [
  /\d+%/g,                          // 퍼센트
  /\$[\d,]+|\d+원|\d+달러/g,         // 금액
  /\d+[KMB]|\d{1,3}(,\d{3})+/g,     // 큰 숫자
  /\d+\.\d+점|\d+\/\d+/g,           // 평점/비율
  /\d+(개|명|회|건|년|월|일|시간)/g,  // 수량+단위
  /[1-5]점|[1-9]\/10/g,             // 점수
  /\d{4}년/g                         // 연도
];

// 액션 아이템 키워드
const ACTION_KEYWORDS = [
  '추천', '제안', '필요', '해야', '고려', '검토',
  '개선', '추가', '구현', '적용', '도입', '활용',
  'should', 'recommend', 'consider', 'implement'
];

// Confidence 태그 (한국어 간결화)
const CONFIDENCE_TAGS = {
  confirmed: ['[확인]'],
  inferred: ['[추론]'],
  speculated: ['[추측]']
};

/**
 * 분석 결과 품질 점수 계산
 * @param {string|object} analysis - 분석 결과 (마크다운 문자열 또는 JSON)
 * @returns {object} 점수 상세
 */
function scoreAnalysis(analysis) {
  const text = typeof analysis === 'string' ? analysis : JSON.stringify(analysis);
  const isJson = typeof analysis === 'object';

  const scores = {
    // 1. Confidence 분포 (CONFIRMED 비율)
    confidenceScore: calculateConfidenceScore(text),

    // 2. 완성도 (필수 섹션 충족률)
    completenessScore: calculateCompletenessScore(analysis, isJson),

    // 3. 구체성 (수치/데이터 포함률)
    specificityScore: calculateSpecificityScore(text),

    // 4. 실행가능성 (액션 아이템 품질)
    actionabilityScore: calculateActionabilityScore(text)
  };

  // 가중 평균 (완성도와 구체성에 높은 가중치, 나머지 낮춤)
  const weights = {
    confidenceScore: 0.1,      // 10% (Claude가 태그 잘 안 씀)
    completenessScore: 0.4,    // 40% (가장 중요)
    specificityScore: 0.4,     // 40% (데이터 품질)
    actionabilityScore: 0.1    // 10% (선택적)
  };

  const totalScore = Object.entries(scores).reduce((sum, [key, value]) => {
    return sum + value * weights[key];
  }, 0);

  // 상세 분석
  const details = {
    confidence: extractConfidenceTags(text),
    sections: checkSections(analysis, isJson),
    specificityCount: countSpecificityIndicators(text),
    actionItems: extractActionItems(text)
  };

  return {
    ...scores,
    totalScore: Math.round(totalScore * 10) / 10,
    grade: getGrade(totalScore),
    details,
    issues: identifyIssues(scores, details),
    timestamp: new Date().toISOString()
  };
}

/**
 * Confidence 점수 계산
 * CONFIRMED 60% 이상이면 만점
 */
function calculateConfidenceScore(text) {
  const tags = extractConfidenceTags(text);

  if (tags.total === 0) {
    // 태그가 없으면 페널티 (태그 사용 안 함)
    return 3;
  }

  const confirmedRatio = tags.confirmed / tags.total;

  // CONFIRMED 60% 이상 → 10점
  // SPECULATED 30% 이상 → 감점
  let score = Math.min(confirmedRatio / 0.6, 1) * 10;

  const speculatedRatio = tags.speculated / tags.total;
  if (speculatedRatio > 0.3) {
    score -= (speculatedRatio - 0.3) * 10;
  }

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

/**
 * Confidence 태그 추출
 */
function extractConfidenceTags(text) {
  let confirmed = 0;
  let inferred = 0;
  let speculated = 0;

  CONFIDENCE_TAGS.confirmed.forEach(tag => {
    const regex = new RegExp(escapeRegex(tag), 'gi');
    const matches = text.match(regex);
    if (matches) confirmed += matches.length;
  });

  CONFIDENCE_TAGS.inferred.forEach(tag => {
    const regex = new RegExp(escapeRegex(tag), 'gi');
    const matches = text.match(regex);
    if (matches) inferred += matches.length;
  });

  CONFIDENCE_TAGS.speculated.forEach(tag => {
    const regex = new RegExp(escapeRegex(tag), 'gi');
    const matches = text.match(regex);
    if (matches) speculated += matches.length;
  });

  const total = confirmed + inferred + speculated;

  return {
    confirmed,
    inferred,
    speculated,
    total,
    distribution: total > 0 ? {
      confirmedPct: Math.round(confirmed / total * 100),
      inferredPct: Math.round(inferred / total * 100),
      speculatedPct: Math.round(speculated / total * 100)
    } : null
  };
}

/**
 * 완성도 점수 계산
 */
function calculateCompletenessScore(analysis, isJson) {
  const sections = checkSections(analysis, isJson);
  const presentCount = sections.filter(s => s.present).length;
  const totalRequired = sections.length;

  // 기본 점수
  let score = (presentCount / totalRequired) * 10;

  // JSON의 경우 추가 체크: ios/android 배열에 앱이 있는지
  if (isJson && typeof analysis === 'object') {
    const iosCount = analysis.ios?.length || 0;
    const androidCount = analysis.android?.length || 0;

    // iOS/Android 각각 최소 1개 이상
    if (iosCount === 0) score -= 2;
    if (androidCount === 0) score -= 2;

    // 앱별 필수 필드 체크
    const checkAppFields = (apps) => {
      if (!Array.isArray(apps)) return 0;
      const requiredFields = ['name', 'idea_summary', 'analysis', 'scores'];
      let validApps = 0;
      apps.forEach(app => {
        const hasAll = requiredFields.every(f => app[f] !== undefined);
        if (hasAll) validApps++;
      });
      return validApps / Math.max(apps.length, 1);
    };

    const iosValid = checkAppFields(analysis.ios);
    const androidValid = checkAppFields(analysis.android);

    // 필드 완성도 반영
    score *= (iosValid + androidValid) / 2 || 0.5;
  } else {
    // 마크다운의 경우 기존 로직 유지
    sections.forEach(section => {
      if (section.present && section.contentLength < 50) {
        score -= 0.5; // 너무 짧은 섹션 페널티
      }
    });
  }

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

/**
 * 섹션 체크
 */
function checkSections(analysis, isJson) {
  const required = isJson ? REQUIRED_SECTIONS.json : REQUIRED_SECTIONS.markdown;
  const text = typeof analysis === 'string' ? analysis : JSON.stringify(analysis);

  return required.map(section => {
    let present = false;
    let contentLength = 0;

    if (isJson) {
      present = analysis.hasOwnProperty(section) && analysis[section] !== null;
      if (present) {
        contentLength = JSON.stringify(analysis[section]).length;
      }
    } else {
      // 마크다운에서 섹션 찾기
      const sectionRegex = new RegExp(`##\\s*${escapeRegex(section)}[\\s\\S]*?(?=##|$)`, 'i');
      const match = text.match(sectionRegex);
      present = !!match;
      if (match) {
        contentLength = match[0].length;
      }
    }

    return { section, present, contentLength };
  });
}

/**
 * 구체성 점수 계산
 */
function calculateSpecificityScore(text) {
  const count = countSpecificityIndicators(text);
  const length = text.length;

  // 1000자당 구체적 데이터 개수
  const density = (count / length) * 1000;

  // 밀도 2.0 이상이면 만점
  let score = Math.min(density / 2.0, 1) * 10;

  // 최소 개수 체크 (최소 5개 이상)
  if (count < 5) {
    score = Math.min(score, count * 2);
  }

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

/**
 * 구체성 지표 카운트
 */
function countSpecificityIndicators(text) {
  let count = 0;

  SPECIFICITY_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  });

  return count;
}

/**
 * 실행가능성 점수 계산
 */
function calculateActionabilityScore(text) {
  const actionItems = extractActionItems(text);

  // 액션 아이템 개수
  const count = actionItems.length;

  // 3-7개가 적정
  let score;
  if (count >= 3 && count <= 7) {
    score = 10;
  } else if (count < 3) {
    score = count * 3;
  } else {
    score = 10 - (count - 7) * 0.5; // 너무 많으면 감점
  }

  // 실행 가능성 키워드 밀도
  let keywordCount = 0;
  ACTION_KEYWORDS.forEach(kw => {
    const regex = new RegExp(kw, 'gi');
    const matches = text.match(regex);
    if (matches) keywordCount += matches.length;
  });

  // 키워드가 적으면 감점
  if (keywordCount < 5) {
    score -= (5 - keywordCount);
  }

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

/**
 * 액션 아이템 추출
 */
function extractActionItems(text) {
  const items = [];

  // 번호 목록에서 액션 키워드 포함된 항목 추출
  const listPattern = /^\s*\d+\.\s*(.+)$/gm;
  let match;

  while ((match = listPattern.exec(text)) !== null) {
    const item = match[1];
    const hasAction = ACTION_KEYWORDS.some(kw =>
      item.toLowerCase().includes(kw.toLowerCase())
    );
    if (hasAction) {
      items.push(item.trim());
    }
  }

  // 개선 제안 섹션 찾기
  const suggestionSection = text.match(/개선 제안[\s\S]*?(?=##|$)/i);
  if (suggestionSection) {
    const bullets = suggestionSection[0].match(/[-•]\s*(.+)/g);
    if (bullets) {
      bullets.forEach(b => items.push(b.replace(/^[-•]\s*/, '').trim()));
    }
  }

  return [...new Set(items)]; // 중복 제거
}

/**
 * 등급 산정
 */
function getGrade(score) {
  if (score >= 9) return 'A+';
  if (score >= 8) return 'A';
  if (score >= 7) return 'B+';
  if (score >= 6) return 'B';
  if (score >= 5) return 'C';
  if (score >= 4) return 'D';
  return 'F';
}

/**
 * 이슈 식별
 */
function identifyIssues(scores, details) {
  const issues = [];

  // Confidence 이슈
  if (scores.confidenceScore < 6) {
    if (details.confidence.total === 0) {
      issues.push({
        type: 'confidence',
        severity: 'high',
        message: 'Confidence 태그가 사용되지 않음',
        suggestion: '[확인됨], [추론], [추측] 태그를 적절히 사용하세요'
      });
    } else if (details.confidence.distribution?.speculatedPct > 30) {
      issues.push({
        type: 'confidence',
        severity: 'medium',
        message: `추측 비율이 높음 (${details.confidence.distribution.speculatedPct}%)`,
        suggestion: '더 많은 정보를 확인하거나, 확인된 정보 위주로 작성하세요'
      });
    }
  }

  // 완성도 이슈
  if (scores.completenessScore < 7) {
    const missingSections = details.sections.filter(s => !s.present);
    if (missingSections.length > 0) {
      issues.push({
        type: 'completeness',
        severity: 'high',
        message: `필수 섹션 누락: ${missingSections.map(s => s.section).join(', ')}`,
        suggestion: '모든 필수 섹션을 포함하세요'
      });
    }

    const shortSections = details.sections.filter(s => s.present && s.contentLength < 50);
    if (shortSections.length > 0) {
      issues.push({
        type: 'completeness',
        severity: 'low',
        message: `내용이 부족한 섹션: ${shortSections.map(s => s.section).join(', ')}`,
        suggestion: '각 섹션에 충분한 분석 내용을 추가하세요'
      });
    }
  }

  // 구체성 이슈
  if (scores.specificityScore < 5) {
    issues.push({
      type: 'specificity',
      severity: 'medium',
      message: `구체적 데이터 부족 (${details.specificityCount}개)`,
      suggestion: '수치, 퍼센트, 금액 등 구체적인 데이터를 포함하세요'
    });
  }

  // 실행가능성 이슈
  if (scores.actionabilityScore < 5) {
    issues.push({
      type: 'actionability',
      severity: 'medium',
      message: `실행 가능한 인사이트 부족 (${details.actionItems.length}개)`,
      suggestion: '구체적인 개선 제안이나 액션 아이템을 추가하세요'
    });
  }

  return issues;
}

/**
 * 정규식 이스케이프
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 품질 리포트 생성 (마크다운)
 */
function generateQualityReport(quality) {
  let report = `## 품질 평가 리포트\n\n`;

  // 총점
  report += `### 총점: ${quality.totalScore}/10 (${quality.grade})\n\n`;

  // 세부 점수
  report += `| 항목 | 점수 | 상태 |\n`;
  report += `|------|------|------|\n`;
  report += `| Confidence 분포 | ${quality.confidenceScore}/10 | ${getStatusEmoji(quality.confidenceScore)} |\n`;
  report += `| 완성도 | ${quality.completenessScore}/10 | ${getStatusEmoji(quality.completenessScore)} |\n`;
  report += `| 구체성 | ${quality.specificityScore}/10 | ${getStatusEmoji(quality.specificityScore)} |\n`;
  report += `| 실행가능성 | ${quality.actionabilityScore}/10 | ${getStatusEmoji(quality.actionabilityScore)} |\n\n`;

  // Confidence 분포
  if (quality.details.confidence.distribution) {
    report += `### Confidence 분포\n`;
    report += `- 확인됨: ${quality.details.confidence.distribution.confirmedPct}%\n`;
    report += `- 추론: ${quality.details.confidence.distribution.inferredPct}%\n`;
    report += `- 추측: ${quality.details.confidence.distribution.speculatedPct}%\n\n`;
  }

  // 이슈
  if (quality.issues.length > 0) {
    report += `### 개선 필요 사항\n\n`;
    quality.issues.forEach(issue => {
      const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
      report += `${icon} **${issue.message}**\n`;
      report += `   → ${issue.suggestion}\n\n`;
    });
  }

  return report;
}

function getStatusEmoji(score) {
  if (score >= 8) return '✅';
  if (score >= 6) return '🟡';
  return '❌';
}

// CLI 지원
if (require.main === module) {
  const fs = require('fs');
  const args = process.argv.slice(2);

  if (args[0]) {
    try {
      const content = fs.readFileSync(args[0], 'utf8');
      const isJson = args[0].endsWith('.json');
      const analysis = isJson ? JSON.parse(content) : content;
      const quality = scoreAnalysis(analysis);

      console.log(generateQualityReport(quality));
      console.log('\n상세 데이터:', JSON.stringify(quality, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
    }
  } else {
    console.log('Usage: node qualityScorer.js <analysis_file.md|json>');
  }
}

module.exports = {
  scoreAnalysis,
  calculateConfidenceScore,
  calculateCompletenessScore,
  calculateSpecificityScore,
  calculateActionabilityScore,
  extractConfidenceTags,
  generateQualityReport,
  REQUIRED_SECTIONS
};
