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
let localLLM = null;
try {
  qualityScorer = require('./qualityScorer');
  trendDetector = require('./trendDetector');
  promptBuilder = require('../prompts/promptBuilder');
  analyzeDeep = require('./analyzeDeep');
  localLLM = require('./localLLM');
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
  maxApps: 1              // 플랫폼별 심층 분석 앱 수 (iOS 1개 + Android 1개 = 2개)
};

// Local LLM 필터링 설정
const LOCAL_LLM_CONFIG = {
  enabled: true,          // Local LLM 필터링 활성화
  topN: 30                // Local LLM이 선별할 앱 수 (플랫폼별)
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
      url: app.url || '',
      country: app.country || 'kr' // 국가 정보 유지
    }));
}

/**
 * 프롬프트를 임시 파일에 저장
 * - Windows stdin 파이프 한계 우회
 */
const TEMP_PROMPT_PATH = path.join(__dirname, '..', 'output', '.temp_prompt.txt');

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
 * - 대용량 stdin 버그 우회: 프롬프트를 파일 저장 후 Claude에게 파일 읽기 지시
 * - ref: https://github.com/anthropics/claude-code/issues/7263
 */
async function analyzeWithCLI(prompt) {
  console.log('  ⏳ Claude CLI 응답 대기 중...');
  const byteSize = Buffer.byteLength(prompt, 'utf-8');
  console.log(`  📝 프롬프트 크기: ${(byteSize / 1024).toFixed(1)}KB`);

  // 프롬프트를 임시 파일에 저장
  const absPath = path.resolve(TEMP_PROMPT_PATH).replace(/\\/g, '/');
  await fs.writeFile(absPath, prompt, 'utf-8');
  console.log(`  📁 프롬프트 파일 저장: ${absPath}`);

  // 짧은 명령을 stdin으로 전달 (100자 미만이라 대용량 stdin 버그 해당 없음)
  const instruction = `Read the file "${absPath}" and follow all instructions in it exactly. Output only the JSON result, starting with { and ending with }.`;
  console.log(`  📨 명령 길이: ${instruction.length}자`);

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--model', 'claude-sonnet-4-20250514', '--print'], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      claude.kill();
      reject(new Error('타임아웃: 10분 초과'));
    }, 10 * 60 * 1000);

    const safeResolve = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };

    const safeReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    };

    claude.stdout.on('data', data => stdout += data.toString());
    claude.stderr.on('data', data => stderr += data.toString());

    claude.on('close', code => {
      const trimmedStderr = stderr.trim();
      if (trimmedStderr) {
        console.log(`  ⚠️ Claude stderr: ${trimmedStderr.substring(0, 500)}`);
      }

      if (code === 0) {
        console.log(`  ✅ Claude 응답 수신 완료 (${stdout.length}자)`);
        safeResolve(stdout);
      } else {
        safeReject(new Error(`Claude 종료 코드 ${code}: ${trimmedStderr || 'stderr 없음'}`));
      }
    });

    claude.on('error', safeReject);

    // 짧은 명령을 stdin으로 전달
    claude.stdin.write(instruction);
    claude.stdin.end();
  });
}

/**
 * JSON 추출 (robust 버전)
 * - 중괄호 균형을 맞춰서 완전한 JSON 객체 추출
 * - 여러 시작점에서 시도하여 유효한 JSON 찾기
 */
function extractJSON(text) {
  let jsonStr = text.trim();

  // 마크다운 코드블록 제거
  jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  // 모든 { 위치 찾기
  const startPositions = [];
  for (let i = 0; i < jsonStr.length; i++) {
    if (jsonStr[i] === '{') {
      startPositions.push(i);
    }
  }

  if (startPositions.length === 0) {
    throw new Error('JSON을 찾을 수 없습니다 (시작 괄호 없음)');
  }

  // 각 시작점에서 균형 잡힌 JSON 추출 시도
  for (const startIdx of startPositions) {
    let depth = 0;
    let endIdx = -1;
    let inString = false;
    let escaped = false;

    for (let i = startIdx; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') depth++;
        else if (char === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const candidate = jsonStr.substring(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(candidate);
        // 유효한 리포트인지 확인 (ios 또는 android 필드 존재)
        if (parsed.ios || parsed.android || parsed.date) {
          console.log(`  ✅ JSON 추출 성공 (위치: ${startIdx}-${endIdx})`);
          return parsed;
        }
      } catch (e) {
        // 이 시작점에서 실패, 다음 시도
        continue;
      }
    }
  }

  // 마지막 시도: 단순히 첫 { 와 마지막 } 사이
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const fallback = jsonStr.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(fallback);
    } catch (e) {
      // 저장하기 전에 raw 텍스트 길이 로깅
      console.log(`  ⚠️ 원본 응답 길이: ${text.length}자`);
      console.log(`  ⚠️ 응답 미리보기: ${text.substring(0, 200)}...`);
    }
  }

  throw new Error('JSON을 찾을 수 없습니다');
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

  // 3. 앱 데이터 로드 (다국가 지원)
  console.log('📱 앱 데이터 로드 중...');
  const rawData = await fs.readFile(inputPath, 'utf-8');
  const appData = JSON.parse(rawData);

  // 다국가 데이터가 있으면 합치기
  let allIosApps = [];
  let allAndroidApps = [];

  if (appData.iOS앱_다국가) {
    // 다국가 데이터: 모든 국가 앱 합치기
    const countries = ['kr', 'us', 'jp'];
    for (const country of countries) {
      const apps = appData.iOS앱_다국가[country] || [];
      apps.forEach(app => {
        app.country = country; // 국가 정보 추가
        allIosApps.push(app);
      });
    }
    for (const country of countries) {
      const apps = appData.Android앱_다국가[country] || [];
      apps.forEach(app => {
        app.country = country;
        allAndroidApps.push(app);
      });
    }
    console.log(`   🌍 다국가 데이터 감지`);
  } else {
    // 기존 단일 국가 데이터
    allIosApps = appData.iOS앱 || [];
    allAndroidApps = appData.Android앱 || [];
  }

  let iosApps = [];
  let androidApps = [];

  // Local LLM 필터링 (활성화된 경우)
  if (localLLM && LOCAL_LLM_CONFIG.enabled) {
    console.log('');
    console.log('🤖 Local LLM 1차 필터링 시작...');
    console.log('─'.repeat(50));

    // Codex CLI 연결 테스트
    const connected = await localLLM.testConnection();
    if (!connected) {
      console.log('  ⚠️ Codex CLI 연결 실패, 기본 필터링 사용');
      iosApps = cleanAppData(allIosApps, MAX_APPS_PER_PLATFORM);
      androidApps = cleanAppData(allAndroidApps, MAX_APPS_PER_PLATFORM);
    } else {
      console.log('  ✅ Codex CLI 연결 성공');

      // iOS 앱 필터링 + 영어 요약
      console.log(`\n  📱 iOS 앱 필터링 (${allIosApps.length}개 → ${LOCAL_LLM_CONFIG.topN}개)`);
      const filteredIos = await localLLM.filterAndSummarize(
        cleanAppData(allIosApps, allIosApps.length),
        LOCAL_LLM_CONFIG.topN
      );
      iosApps = filteredIos;

      // Android 앱 필터링 + 영어 요약
      console.log(`\n  📱 Android 앱 필터링 (${allAndroidApps.length}개 → ${LOCAL_LLM_CONFIG.topN}개)`);
      const filteredAndroid = await localLLM.filterAndSummarize(
        cleanAppData(allAndroidApps, allAndroidApps.length),
        LOCAL_LLM_CONFIG.topN
      );
      androidApps = filteredAndroid;

      console.log('');
      console.log('─'.repeat(50));
      console.log('✅ Local LLM 필터링 완료!');
    }
  } else {
    // 기존 방식 (Local LLM 없이)
    iosApps = cleanAppData(allIosApps, MAX_APPS_PER_PLATFORM);
    androidApps = cleanAppData(allAndroidApps, MAX_APPS_PER_PLATFORM);
  }

  console.log(`   iOS: ${iosApps.length}개 / Android: ${androidApps.length}개`);

  // 4. 프롬프트 구성 (제외 목록 포함)
  // 영어 요약이 있으면 영어로 전달 (토큰 절감)
  const hasEnglishSummary = iosApps[0]?.summary_en || androidApps[0]?.summary_en;

  let cleanedData;
  if (hasEnglishSummary) {
    console.log('   📝 영어 요약 사용 (토큰 절감)');
    cleanedData = {
      date: appData.날짜,
      exclude_apps: excludeList.length > 0 ? excludeList : [],
      iOS_apps: iosApps.map(app => ({
        name: app.name_en || app.name,
        developer: app.developer,
        category: app.category_en || app.category,
        summary: app.summary_en || '',
        icon: app.icon,
        url: app.url,
        llm_score: app.llmScore || 0
      })),
      Android_apps: androidApps.map(app => ({
        name: app.name_en || app.name,
        developer: app.developer,
        category: app.category_en || app.category,
        summary: app.summary_en || '',
        icon: app.icon,
        url: app.url,
        llm_score: app.llmScore || 0
      }))
    };
  } else {
    cleanedData = {
      날짜: appData.날짜,
      제외할_앱: excludeList.length > 0 ? excludeList : [],
      iOS앱: iosApps,
      Android앱: androidApps
    };
  }

  let fullPrompt = promptTemplate + '\n' + JSON.stringify(cleanedData, null, 2);
  fullPrompt += '\n\n---\n\n위 앱들을 분석하고 아래에 JSON을 출력하세요 (설명 없이 바로 {로 시작):\n';
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

      const trimmedResult = (result || '').trim();
      if (!trimmedResult) {
        console.error('  ❌ Claude가 빈 응답을 반환했습니다.');
        if (attempts < maxAttempts) {
          console.log('  🔄 빈 응답으로 재시도...');
          continue;
        }

        try {
          await fs.writeFile(path.join(projectDir, 'output', 'last_raw_response.txt'), result || '', 'utf-8');
          console.log('  📝 디버그 응답 저장: output/last_raw_response.txt');
        } catch (saveError) {
          console.log(`  ⚠️ 디버그 응답 저장 실패: ${saveError.message}`);
        }

        throw new Error('Claude가 빈 응답을 반복 반환하여 중단합니다.');
      }

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

        try {
          await fs.writeFile(path.join(projectDir, 'output', 'last_raw_response.txt'), result, 'utf-8');
          console.log('  📝 디버그 응답 저장: output/last_raw_response.txt');
        } catch (saveError) {
          console.log(`  ⚠️ 디버그 응답 저장 실패: ${saveError.message}`);
        }

        const preview = result.substring(0, 300).replace(/\s+/g, ' ');
        throw new Error(`JSON 파싱 최종 실패: ${parseError.message} (응답 길이: ${result.length}자, 미리보기: ${preview})`);
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

    // 8. 결과 검증 (최소 5개씩 확인)
    const MIN_APPS = 5;
    const iosCount = report.ios?.length || 0;
    const androidCount = report.android?.length || 0;

    if (iosCount === 0 || androidCount === 0) {
      throw new Error(`분석 결과 앱이 비어 있습니다 (iOS: ${iosCount}, Android: ${androidCount})`);
    }

    if (iosCount < MIN_APPS || androidCount < MIN_APPS) {
      console.log(`  ⚠️ 경고: 앱 개수 부족 (iOS: ${iosCount}, Android: ${androidCount})`);
      console.log(`     최소 ${MIN_APPS}개씩 필요합니다.`);
    }

    // 9. 저장
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('');
    console.log('═'.repeat(50));
    console.log('✅ 기본 분석 완료!');
    if (report.ios) console.log(`   iOS: ${report.ios.length}개 ${iosCount < MIN_APPS ? '⚠️ 부족' : '✓'}`);
    if (report.android) console.log(`   Android: ${report.android.length}개 ${androidCount < MIN_APPS ? '⚠️ 부족' : '✓'}`);
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
