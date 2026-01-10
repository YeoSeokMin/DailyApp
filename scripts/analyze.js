/**
 * analyze.js
 *
 * 역할: Claude로 수집된 앱 분석 & TOP 5 선별
 * - ANTHROPIC_API_KEY가 있으면 API 사용 (GitHub Actions용)
 * - 없으면 Claude CLI 사용 (로컬용)
 * - 품질 점수 체크 & 자동 재시도
 * - 트렌드 자동 감지
 */

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// 새 모듈 로드 (옵션)
let qualityScorer = null;
let trendDetector = null;
let promptBuilder = null;
let analyzeDeep = null;
try {
  qualityScorer = require('./qualityScorer');
  trendDetector = require('./trendDetector');
  promptBuilder = require('../prompts/promptBuilder');
  analyzeDeep = require('./analyzeDeep');
} catch (e) {
  // 모듈 없으면 무시
  console.log('  ⚠️ 일부 모듈 로드 실패:', e.message);
}

const MAX_APPS_PER_PLATFORM = 30;
const EXCLUDE_DAYS = 7; // 최근 7일간 리포트에 나온 앱 제외
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// 품질 설정
const QUALITY_CONFIG = {
  enabled: true,          // 품질 체크 활성화
  minScore: 4,            // 최소 품질 점수 (10점 만점) - 낮춤
  maxRetries: 1           // 최대 재시도 횟수 - 1회로 줄임
};

// 심층 분석 설정
const DEEP_ANALYSIS_CONFIG = {
  enabled: true,          // 심층 분석 활성화
  maxApps: 5              // 플랫폼별 심층 분석 앱 수 (상위 N개)
};

/**
 * 최근 리포트에서 이미 선정된 앱 이름 가져오기
 */
async function getRecentAppNames(reportsDir, days) {
  const appNames = new Set();

  try {
    const files = await fs.readdir(reportsDir);
    const jsonFiles = files
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, days);

    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(reportsDir, file), 'utf-8');
        const report = JSON.parse(content);

        if (report.ios) {
          report.ios.forEach(app => appNames.add(app.name.toLowerCase()));
        }
        if (report.android) {
          report.android.forEach(app => appNames.add(app.name.toLowerCase()));
        }
      } catch (e) {
        // 파일 읽기 실패 시 무시
      }
    }
  } catch (e) {
    // 디렉토리 없으면 무시
  }

  return appNames;
}

/**
 * 앱 데이터 정리
 */
function cleanAppData(apps, limit) {
  return apps
    .slice(0, limit)
    .map(app => ({
      name: app.name,
      developer: app.developer || '',
      category: app.category || '',
      icon: app.icon || '',
      url: app.url || ''
    }));
}

/**
 * Anthropic API로 분석 (GitHub Actions용)
 */
async function analyzeWithAPI(prompt) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  console.log('  🌐 Anthropic API 호출 중...');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

/**
 * Claude CLI로 분석 (로컬용)
 */
function analyzeWithCLI(prompt) {
  return new Promise((resolve, reject) => {
    console.log('  ⏳ Claude CLI 응답 대기 중...');

    const claude = spawn('claude', ['--print'], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', data => stdout += data.toString());
    claude.stderr.on('data', data => stderr += data.toString());

    claude.on('close', code => {
      if (code === 0) {
        console.log('  ✅ Claude 응답 수신 완료');
        resolve(stdout);
      } else {
        reject(new Error(`Claude 종료 코드 ${code}: ${stderr}`));
      }
    });

    claude.on('error', reject);
    claude.stdin.write(prompt);
    claude.stdin.end();

    setTimeout(() => {
      claude.kill();
      reject(new Error('타임아웃: 10분 초과'));
    }, 10 * 60 * 1000);
  });
}

/**
 * JSON 추출
 */
function extractJSON(text) {
  let jsonStr = text.trim();
  jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  const startIdx = jsonStr.indexOf('{');
  const endIdx = jsonStr.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('JSON을 찾을 수 없습니다');
  }

  return JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
}

async function main() {
  console.log('');
  console.log('🤖 앱 아이디어 분석 시작');
  console.log('═'.repeat(50));

  const projectDir = path.join(__dirname, '..');
  const inputPath = path.join(projectDir, 'output', 'collected_apps.json');
  const outputPath = path.join(projectDir, 'output', 'report.json');
  const promptPath = path.join(__dirname, 'prompt.txt');
  const reportsDir = path.join(projectDir, 'web', 'data', 'reports');

  // 1. 프롬프트 로드 (동적 빌더 또는 기본 파일)
  console.log('📝 프롬프트 로드 중...');
  let promptTemplate;
  if (promptBuilder) {
    console.log('   🔧 Dynamic Prompt Builder 사용');
    promptTemplate = promptBuilder.presets.daily();
  } else {
    console.log('   📄 기본 prompt.txt 사용');
    promptTemplate = await fs.readFile(promptPath, 'utf-8');
  }

  // 2. 최근 리포트에서 이미 선정된 앱 목록 가져오기
  console.log('🔍 이전 선정 앱 확인 중...');
  const excludeNames = await getRecentAppNames(reportsDir, EXCLUDE_DAYS);
  const excludeList = Array.from(excludeNames);
  console.log(`   최근 ${EXCLUDE_DAYS}일간 선정된 앱: ${excludeNames.size}개`);

  // 3. 앱 데이터 로드
  console.log('📱 앱 데이터 로드 중...');
  const rawData = await fs.readFile(inputPath, 'utf-8');
  const appData = JSON.parse(rawData);

  const iosApps = cleanAppData(appData.iOS앱 || [], MAX_APPS_PER_PLATFORM);
  const androidApps = cleanAppData(appData.Android앱 || [], MAX_APPS_PER_PLATFORM);

  console.log(`   iOS: ${iosApps.length}개 / Android: ${androidApps.length}개`);

  // 4. 프롬프트 구성 (제외 목록 포함)
  const cleanedData = {
    날짜: appData.날짜,
    제외할_앱: excludeList.length > 0 ? excludeList : [],
    iOS앱: iosApps,
    Android앱: androidApps
  };

  let fullPrompt = promptTemplate + '\n' + JSON.stringify(cleanedData, null, 2);
  console.log(`   프롬프트: ${(fullPrompt.length / 1024).toFixed(1)}KB`);
  console.log('');

  // 5. 분석 실행 (품질 체크 & 재시도 포함)
  console.log('🧠 Claude 분석 중...');
  console.log(`   모드: ${ANTHROPIC_API_KEY ? 'API' : 'CLI'}`);

  let report = null;
  let quality = null;
  let attempts = 0;
  const maxAttempts = QUALITY_CONFIG.enabled ? QUALITY_CONFIG.maxRetries + 1 : 1;

  try {
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`   시도 ${attempts}/${maxAttempts}`);

      const result = ANTHROPIC_API_KEY
        ? await analyzeWithAPI(fullPrompt)
        : await analyzeWithCLI(fullPrompt);

      // 6. JSON 파싱
      console.log('📊 결과 파싱 중...');

      try {
        report = extractJSON(result);
        console.log('  ✅ JSON 파싱 성공');
      } catch (parseError) {
        console.error('  ⚠️ JSON 파싱 실패:', parseError.message);
        if (attempts < maxAttempts) {
          console.log('  🔄 재시도...');
          continue;
        }
        report = { raw: result, error: parseError.message };
        break;
      }

      // 7. 품질 체크 (모듈 있을 때만)
      if (qualityScorer && QUALITY_CONFIG.enabled) {
        quality = qualityScorer.scoreAnalysis(JSON.stringify(report));
        console.log(`📈 품질 점수: ${quality.totalScore}/10 (${quality.grade})`);

        if (quality.totalScore >= QUALITY_CONFIG.minScore) {
          console.log('  ✅ 품질 기준 충족');
          break;
        } else if (attempts < maxAttempts) {
          console.log(`  ⚠️ 품질 미달 (${quality.totalScore} < ${QUALITY_CONFIG.minScore})`);
          console.log('  🔄 재시도...');

          // 이슈 피드백을 프롬프트에 추가
          if (quality.issues.length > 0) {
            const feedback = quality.issues.map(i => `- ${i.message}`).join('\n');
            fullPrompt += `\n\n[이전 분석 피드백 - 개선 필요]\n${feedback}\n`;
          }
        }
      } else {
        break; // 품질 체크 없으면 바로 종료
      }
    }

    // 8. 저장
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('');
    console.log('═'.repeat(50));
    console.log('✅ 기본 분석 완료!');
    if (report.ios) console.log(`   iOS: ${report.ios.length}개`);
    if (report.android) console.log(`   Android: ${report.android.length}개`);
    if (quality) console.log(`   품질: ${quality.totalScore}/10 (${quality.grade})`);
    console.log(`   시도: ${attempts}회`);
    console.log('═'.repeat(50));

    // 9. 심층 분석 (모듈 있을 때만)
    if (analyzeDeep && DEEP_ANALYSIS_CONFIG.enabled) {
      console.log('');
      console.log('🔬 심층 분석 시작...');
      console.log('─'.repeat(50));

      try {
        // iOS 앱 심층 분석 (상위 N개)
        if (report.ios && report.ios.length > 0) {
          console.log('\n📱 iOS 심층 분석');
          const iosTopApps = report.ios.slice(0, DEEP_ANALYSIS_CONFIG.maxApps);
          const iosWithDeep = await analyzeDeep.analyzeAllDeep(iosTopApps, 'ios');

          // deep_report_id 업데이트
          report.ios = report.ios.map((app, idx) => {
            if (idx < iosWithDeep.length) {
              return { ...app, deep_report_id: iosWithDeep[idx].deep_report_id };
            }
            return app;
          });
        }

        // Android 앱 심층 분석 (상위 N개)
        if (report.android && report.android.length > 0) {
          console.log('\n📱 Android 심층 분석');
          const androidTopApps = report.android.slice(0, DEEP_ANALYSIS_CONFIG.maxApps);
          const androidWithDeep = await analyzeDeep.analyzeAllDeep(androidTopApps, 'android');

          // deep_report_id 업데이트
          report.android = report.android.map((app, idx) => {
            if (idx < androidWithDeep.length) {
              return { ...app, deep_report_id: androidWithDeep[idx].deep_report_id };
            }
            return app;
          });
        }

        // 업데이트된 리포트 저장
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
        console.log('\n✅ 심층 분석 완료! 리포트 업데이트됨');
      } catch (deepError) {
        console.log('  ⚠️ 심층 분석 스킵:', deepError.message);
      }
    }

    // 10. 트렌드 감지 (모듈 있을 때만)
    if (trendDetector) {
      console.log('');
      console.log('📊 트렌드 분석 중...');
      try {
        const trends = await trendDetector.detectTrends(7);
        if (trends && trends.insight) {
          console.log(`   이번 주 테마: ${trends.insight.weekly_theme || 'N/A'}`);
          console.log(`   ${trends.insight.trend_summary || ''}`);
        }
      } catch (trendError) {
        console.log('  ⚠️ 트렌드 분석 스킵:', trendError.message);
      }
    }

  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
