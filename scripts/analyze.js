/**
 * analyze.js
 *
 * 역할: Claude로 수집된 앱 분석 & TOP 5 선별
 * - ANTHROPIC_API_KEY가 있으면 API 사용 (GitHub Actions용)
 * - 없으면 Claude CLI 사용 (로컬용)
 */

require('dotenv').config();

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const MAX_APPS_PER_PLATFORM = 30;
const EXCLUDE_DAYS = 7; // 최근 7일간 리포트에 나온 앱 제외
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
 * 앱 데이터 정리 (중복 제거 포함)
 */
function cleanAppData(apps, limit, excludeNames = new Set()) {
  return apps
    .filter(app => !excludeNames.has(app.name.toLowerCase()))
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
      reject(new Error('타임아웃: 5분 초과'));
    }, 5 * 60 * 1000);
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

  // 1. 프롬프트 로드
  console.log('📝 프롬프트 로드 중...');
  const promptTemplate = await fs.readFile(promptPath, 'utf-8');

  // 2. 최근 리포트에서 중복 앱 목록 가져오기
  console.log('🔍 중복 앱 필터링 중...');
  const excludeNames = await getRecentAppNames(reportsDir, EXCLUDE_DAYS);
  console.log(`   최근 ${EXCLUDE_DAYS}일간 선정된 앱: ${excludeNames.size}개 제외`);

  // 3. 앱 데이터 로드 (중복 제외)
  console.log('📱 앱 데이터 로드 중...');
  const rawData = await fs.readFile(inputPath, 'utf-8');
  const appData = JSON.parse(rawData);

  const iosApps = cleanAppData(appData.iOS앱 || [], MAX_APPS_PER_PLATFORM, excludeNames);
  const androidApps = cleanAppData(appData.Android앱 || [], MAX_APPS_PER_PLATFORM, excludeNames);

  console.log(`   iOS: ${iosApps.length}개 / Android: ${androidApps.length}개`);

  // 4. 프롬프트 구성
  const cleanedData = {
    날짜: appData.날짜,
    iOS앱: iosApps,
    Android앱: androidApps
  };

  const fullPrompt = promptTemplate + '\n' + JSON.stringify(cleanedData, null, 2);
  console.log(`   프롬프트: ${(fullPrompt.length / 1024).toFixed(1)}KB`);
  console.log('');

  // 5. 분석 실행
  console.log('🧠 Claude 분석 중...');
  console.log(`   모드: ${ANTHROPIC_API_KEY ? 'API' : 'CLI'}`);

  try {
    const result = ANTHROPIC_API_KEY
      ? await analyzeWithAPI(fullPrompt)
      : await analyzeWithCLI(fullPrompt);

    // 6. JSON 파싱
    console.log('📊 결과 파싱 중...');
    let report;

    try {
      report = extractJSON(result);
      console.log('  ✅ JSON 파싱 성공');
    } catch (parseError) {
      console.error('  ⚠️ JSON 파싱 실패:', parseError.message);
      report = { raw: result, error: parseError.message };
    }

    // 7. 저장
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('');
    console.log('═'.repeat(50));
    console.log('✅ 분석 완료!');
    if (report.ios) console.log(`   iOS: ${report.ios.length}개`);
    if (report.android) console.log(`   Android: ${report.android.length}개`);
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
