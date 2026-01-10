/**
 * analyzeWithRetry.js
 *
 * 품질 보장 분석 시스템
 * - 품질 점수 기반 자동 재시도
 * - 문제 영역 피드백
 * - 점진적 품질 향상
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const { scoreAnalysis, generateQualityReport } = require('./qualityScorer');
const { buildPrompt, presets } = require('../prompts/promptBuilder');

// 설정
const CONFIG = {
  minQualityScore: 7,           // 최소 품질 점수
  maxRetries: 3,                // 최대 재시도 횟수
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8000,
  retryDelay: 1000              // 재시도 전 대기 (ms)
};

// Anthropic 클라이언트
let anthropic = null;

function getClient() {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropic;
}

/**
 * 품질 보장 분석 실행
 * @param {object} app - 분석할 앱 정보
 * @param {object} options - 옵션
 */
async function analyzeWithQualityGuard(app, options = {}) {
  const {
    minScore = CONFIG.minQualityScore,
    maxRetries = CONFIG.maxRetries,
    outputFormat = 'markdown',
    category = null,
    includeKorea = true,
    verbose = true
  } = options;

  const results = {
    app: app.name,
    attempts: [],
    finalAnalysis: null,
    finalQuality: null,
    success: false
  };

  let previousIssues = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (verbose) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📊 분석 시도 ${attempt}/${maxRetries}: ${app.name}`);
      console.log(`${'='.repeat(50)}`);
    }

    try {
      // 1. 프롬프트 생성 (이전 이슈 피드백 포함)
      const prompt = buildAnalysisPrompt(app, {
        outputFormat,
        category: category || app.category,
        includeKorea,
        previousIssues,
        attempt
      });

      // 2. 분석 실행
      const analysis = await runAnalysis(prompt, outputFormat);

      // 3. 품질 평가
      const quality = scoreAnalysis(analysis);

      if (verbose) {
        console.log(`\n📈 품질 점수: ${quality.totalScore}/10 (${quality.grade})`);
        console.log(`   - Confidence: ${quality.confidenceScore}/10`);
        console.log(`   - 완성도: ${quality.completenessScore}/10`);
        console.log(`   - 구체성: ${quality.specificityScore}/10`);
        console.log(`   - 실행가능성: ${quality.actionabilityScore}/10`);
      }

      // 시도 기록
      results.attempts.push({
        attempt,
        quality: quality.totalScore,
        grade: quality.grade,
        issues: quality.issues.map(i => i.message)
      });

      // 4. 품질 체크
      if (quality.totalScore >= minScore) {
        if (verbose) {
          console.log(`\n✅ 품질 기준 충족! (${quality.totalScore} >= ${minScore})`);
        }

        results.finalAnalysis = analysis;
        results.finalQuality = quality;
        results.success = true;

        return results;
      }

      // 5. 품질 미달 - 이슈 분석
      if (verbose) {
        console.log(`\n⚠️ 품질 미달 (${quality.totalScore} < ${minScore})`);
        console.log(`\n발견된 이슈:`);
        quality.issues.forEach(issue => {
          const icon = issue.severity === 'high' ? '🔴' : '🟡';
          console.log(`  ${icon} ${issue.message}`);
        });
      }

      // 6. 다음 시도를 위한 피드백 준비
      previousIssues = quality.issues;

      // 마지막 시도가 아니면 대기
      if (attempt < maxRetries) {
        if (verbose) console.log(`\n⏳ ${CONFIG.retryDelay}ms 후 재시도...`);
        await sleep(CONFIG.retryDelay);
      }

    } catch (error) {
      console.error(`❌ 분석 실패 (시도 ${attempt}):`, error.message);

      results.attempts.push({
        attempt,
        error: error.message
      });

      if (attempt < maxRetries) {
        await sleep(CONFIG.retryDelay);
      }
    }
  }

  // 모든 시도 실패
  if (verbose) {
    console.log(`\n❌ ${maxRetries}회 시도 후에도 품질 기준 미달`);
  }

  // 마지막 분석 결과라도 반환
  if (results.attempts.length > 0) {
    const lastAttempt = results.attempts[results.attempts.length - 1];
    if (!lastAttempt.error) {
      results.finalQuality = { totalScore: lastAttempt.quality, grade: lastAttempt.grade };
    }
  }

  return results;
}

/**
 * 분석 프롬프트 생성
 */
function buildAnalysisPrompt(app, options) {
  const { outputFormat, category, includeKorea, previousIssues, attempt } = options;

  // 기본 프롬프트 구성
  let prompt = buildPrompt({
    outputFormat,
    category,
    includeKorea,
    depth: 'full'
  });

  // 재시도인 경우 피드백 추가
  if (attempt > 1 && previousIssues.length > 0) {
    prompt += `\n\n---\n\n`;
    prompt += `## ⚠️ 이전 분석 피드백 (시도 ${attempt})\n\n`;
    prompt += `이전 분석에서 다음 문제가 발견되었습니다. 이번 분석에서 반드시 개선하세요:\n\n`;

    previousIssues.forEach((issue, i) => {
      prompt += `${i + 1}. **${issue.type}**: ${issue.message}\n`;
      prompt += `   → 개선 방법: ${issue.suggestion}\n\n`;
    });

    prompt += `\n위 문제들을 해결하여 더 높은 품질의 분석을 제공하세요.\n\n`;
    prompt += `---\n\n`;
  }

  // 앱 정보 추가
  prompt += `\n분석할 앱:\n`;
  prompt += `- 이름: ${app.name}\n`;
  prompt += `- 개발사: ${app.developer || 'N/A'}\n`;
  prompt += `- 카테고리: ${app.category || 'N/A'}\n`;
  if (app.description) {
    prompt += `- 설명: ${app.description}\n`;
  }
  if (app.url) {
    prompt += `- URL: ${app.url}\n`;
  }

  return prompt;
}

/**
 * Claude API로 분석 실행
 */
async function runAnalysis(prompt, outputFormat) {
  const client = getClient();

  const response = await client.messages.create({
    model: CONFIG.model,
    max_tokens: CONFIG.maxTokens,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.content[0].text;

  // JSON 형식인 경우 파싱
  if (outputFormat === 'json') {
    try {
      return JSON.parse(content);
    } catch (e) {
      // JSON 블록 추출 시도
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('JSON 파싱 실패');
    }
  }

  return content;
}

/**
 * 대기 함수
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 배치 분석 (여러 앱)
 */
async function analyzeBatch(apps, options = {}) {
  const { concurrent = 1, ...analyzeOptions } = options;

  const results = [];

  if (concurrent === 1) {
    // 순차 처리
    for (const app of apps) {
      const result = await analyzeWithQualityGuard(app, analyzeOptions);
      results.push(result);
    }
  } else {
    // 병렬 처리 (concurrent 개수만큼)
    for (let i = 0; i < apps.length; i += concurrent) {
      const batch = apps.slice(i, i + concurrent);
      const batchResults = await Promise.all(
        batch.map(app => analyzeWithQualityGuard(app, analyzeOptions))
      );
      results.push(...batchResults);
    }
  }

  // 요약 통계
  const summary = {
    total: results.length,
    success: results.filter(r => r.success).length,
    avgScore: results
      .filter(r => r.finalQuality)
      .reduce((sum, r) => sum + r.finalQuality.totalScore, 0) / results.length,
    avgAttempts: results.reduce((sum, r) => sum + r.attempts.length, 0) / results.length
  };

  return { results, summary };
}

/**
 * 결과 저장
 */
async function saveResults(results, outputPath) {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  if (outputPath.endsWith('.json')) {
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf8');
  } else {
    // 마크다운으로 저장
    let md = `# 분석 결과\n\n`;
    md += `생성 시간: ${new Date().toLocaleString('ko-KR')}\n\n`;

    if (results.finalAnalysis) {
      md += results.finalAnalysis;
      md += `\n\n---\n\n`;
      md += generateQualityReport(results.finalQuality);
    }

    await fs.writeFile(outputPath, md, 'utf8');
  }

  console.log(`💾 결과 저장: ${outputPath}`);
}

/**
 * CLI용 래퍼
 */
async function analyzeFromCLI(appName, options = {}) {
  // 간단한 앱 객체 생성
  const app = {
    name: appName,
    category: options.category || null
  };

  return analyzeWithQualityGuard(app, {
    ...options,
    verbose: true
  });
}

// CLI 지원
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node analyzeWithRetry.js <app_name> [options]');
    console.log('Options:');
    console.log('  --category=<cat>    앱 카테고리');
    console.log('  --format=<format>   출력 형식 (markdown|json)');
    console.log('  --min-score=<n>     최소 품질 점수 (기본: 7)');
    console.log('  --max-retries=<n>   최대 재시도 (기본: 3)');
    console.log('  --output=<path>     결과 저장 경로');
    process.exit(0);
  }

  const appName = args[0];
  const options = {};

  args.slice(1).forEach(arg => {
    const [key, value] = arg.replace('--', '').split('=');
    if (key === 'category') options.category = value;
    if (key === 'format') options.outputFormat = value;
    if (key === 'min-score') options.minScore = parseInt(value);
    if (key === 'max-retries') options.maxRetries = parseInt(value);
    if (key === 'output') options.outputPath = value;
  });

  analyzeFromCLI(appName, options)
    .then(async results => {
      console.log('\n' + '='.repeat(50));
      console.log('📋 최종 결과:');
      console.log(`   앱: ${results.app}`);
      console.log(`   성공: ${results.success ? '✅' : '❌'}`);
      console.log(`   시도 횟수: ${results.attempts.length}`);

      if (results.finalQuality) {
        console.log(`   최종 품질: ${results.finalQuality.totalScore}/10 (${results.finalQuality.grade})`);
      }

      // 결과 저장
      if (options.outputPath) {
        await saveResults(results, options.outputPath);
      }
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = {
  analyzeWithQualityGuard,
  analyzeBatch,
  saveResults,
  CONFIG
};
