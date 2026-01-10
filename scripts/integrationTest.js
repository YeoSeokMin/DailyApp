/**
 * integrationTest.js
 *
 * Dynamic Prompt + Quality Scoring + Confidence Tags 통합 테스트
 */

require('dotenv').config();
const { spawn } = require('child_process');
const promptBuilder = require('../prompts/promptBuilder');
const qualityScorer = require('./qualityScorer');
const { generateAppId } = require('./analyzeDeep');

// 테스트용 게임 앱 데이터
const TEST_GAME_APP = {
  name: "Squad Busters",
  developer: "Supercell",
  category: "Games",
  icon: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/test.png",
  url: "https://apps.apple.com/app/squad-busters/id1625668957"
};

async function runTest() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('🧪 통합 테스트 시작');
  console.log('═'.repeat(60));
  console.log('');

  // 1. Dynamic Prompt 테스트
  console.log('📋 1. Dynamic Prompt 테스트');
  console.log('─'.repeat(40));

  // 게임 카테고리로 프롬프트 생성
  const gamePrompt = promptBuilder.buildPrompt({
    outputFormat: 'daily',
    includeKorea: true,
    category: 'Games',
    depth: 'standard'
  });

  console.log('   ✅ 프롬프트 생성 완료');
  console.log(`   📏 프롬프트 길이: ${(gamePrompt.length / 1024).toFixed(1)}KB`);

  // 게임 모듈 포함 확인
  const hasGameModule = gamePrompt.includes('[M-GAME]') || gamePrompt.includes('Core Loop') || gamePrompt.includes('수익화 구조');
  console.log(`   🎮 게임 모듈 포함: ${hasGameModule ? '✅ YES' : '❌ NO'}`);

  // Confidence 태그 규칙 포함 확인
  const hasConfidenceTags = gamePrompt.includes('[확인]') || gamePrompt.includes('CONFIDENCE TAGGING');
  console.log(`   🏷️ Confidence 태그 규칙: ${hasConfidenceTags ? '✅ YES' : '❌ NO'}`);

  // Anti-Hallucination 포함 확인
  const hasAntiHallucination = gamePrompt.includes('Anti-Hallucination') || gamePrompt.includes('금지 사항');
  console.log(`   🚫 Anti-Hallucination: ${hasAntiHallucination ? '✅ YES' : '❌ NO'}`);

  console.log('');

  // 2. output-daily 포맷 테스트
  console.log('📋 2. output-daily 포맷 테스트');
  console.log('─'.repeat(40));

  const hasIosAndroid = gamePrompt.includes('"ios"') && gamePrompt.includes('"android"');
  console.log(`   📱 ios/android 배열: ${hasIosAndroid ? '✅ YES' : '❌ NO'}`);

  const hasDailyInsight = gamePrompt.includes('daily_insight');
  console.log(`   💡 daily_insight 포함: ${hasDailyInsight ? '✅ YES' : '❌ NO'}`);

  const hasScores = gamePrompt.includes('"scores"') || gamePrompt.includes('novelty');
  console.log(`   📊 점수 구조: ${hasScores ? '✅ YES' : '❌ NO'}`);

  console.log('');

  // 3. Quality Scorer 테스트
  console.log('📋 3. Quality Scorer 테스트');
  console.log('─'.repeat(40));

  // 샘플 분석 결과로 품질 테스트
  const sampleAnalysis = {
    date: "2025-01-10",
    ios: [{
      rank: 1,
      name: "Squad Busters",
      developer: "Supercell",
      category: "Games",
      idea_summary: "Supercell 캐릭터 총출동 배틀로얄 [확인]",
      analysis: {
        problem: "기존 배틀로얄의 복잡한 조작 [추론]",
        solution: "간단한 터치 조작의 캐주얼 배틀로얄 [확인]",
        target_user: "Supercell 게임 팬, 캐주얼 게이머 [추론]",
        unique_point: "Supercell IP 크로스오버 [확인]"
      },
      scores: {
        novelty: 4,
        necessity: 4,
        timing: 5,
        tech_difficulty: 3,
        market_size: 5,
        competition: 3,
        profitability: 5,
        scalability: 4,
        overall: 8.5
      }
    }],
    android: [],
    daily_insight: {
      trend_summary: "슈퍼셀 신작 출시로 캐주얼 배틀로얄 시장 활성화",
      hot_categories: ["Games"],
      opportunity: "캐주얼 배틀로얄",
      action_item: "간단한 조작 + IP 활용 전략"
    }
  };

  const quality = qualityScorer.scoreAnalysis(sampleAnalysis);

  console.log(`   📈 품질 점수: ${quality.totalScore}/10 (${quality.grade})`);
  console.log(`   ├─ Confidence: ${quality.confidenceScore}/10`);
  console.log(`   ├─ 완성도: ${quality.completenessScore}/10`);
  console.log(`   ├─ 구체성: ${quality.specificityScore}/10`);
  console.log(`   └─ 실행가능성: ${quality.actionabilityScore}/10`);

  if (quality.issues.length > 0) {
    console.log(`   ⚠️ 이슈: ${quality.issues.length}개`);
    quality.issues.forEach(issue => {
      console.log(`      - ${issue.message}`);
    });
  }

  console.log('');

  // 4. 심층 분석 모듈 테스트
  console.log('📋 4. 심층 분석 모듈 테스트');
  console.log('─'.repeat(40));

  const testAppId = generateAppId('ios', 'Test App 123');
  console.log(`   ✅ App ID 생성: ${testAppId}`);

  const idHasValidFormat = testAppId.startsWith('ios-') && testAppId.includes('test-app');
  console.log(`   📝 ID 포맷 검증: ${idHasValidFormat ? '✅ YES' : '❌ NO'}`);

  console.log('');

  // 5. 프롬프트 모듈 목록
  console.log('📋 5. 사용된 모듈');
  console.log('─'.repeat(40));

  const moduleMatch = gamePrompt.match(/<!-- Prompt built with modules: \[(.*?)\] -->/);
  if (moduleMatch) {
    const modules = moduleMatch[1].split(', ');
    modules.forEach(m => console.log(`   ✅ ${m}`));
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('🎉 통합 테스트 완료!');
  console.log('═'.repeat(60));

  // 결과 요약
  const testResults = {
    dynamicPrompt: hasGameModule && hasConfidenceTags && hasAntiHallucination,
    outputFormat: hasIosAndroid && hasDailyInsight && hasScores,
    qualityScoring: quality.totalScore > 0,
    deepAnalysis: idHasValidFormat,
    allPassed: false
  };
  testResults.allPassed = testResults.dynamicPrompt && testResults.outputFormat && testResults.qualityScoring && testResults.deepAnalysis;

  console.log('');
  console.log('📊 테스트 결과 요약');
  console.log(`   Dynamic Prompt: ${testResults.dynamicPrompt ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Output Format: ${testResults.outputFormat ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Quality Scoring: ${testResults.qualityScoring ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Deep Analysis: ${testResults.deepAnalysis ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  console.log(`   종합: ${testResults.allPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);

  return testResults;
}

// 실행
runTest().catch(err => {
  console.error('❌ 테스트 실패:', err);
  process.exit(1);
});
