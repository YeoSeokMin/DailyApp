/**
 * analyzeDeep.js
 *
 * 심층 분석 모듈
 * - prompt-deep.txt 사용
 * - 경쟁앱 조사 통합
 * - 개별 마크다운 리포트 생성
 * - reports/deep/ 디렉토리에 저장
 */

require('dotenv').config();

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { findCompetitors } = require('./competitiveResearch');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// 디렉토리 설정
const DEEP_REPORTS_DIR = path.join(__dirname, '..', 'reports', 'deep');
const WEB_REPORTS_DIR = path.join(__dirname, '..', 'web', 'data', 'deep-reports');
const PROMPT_DEEP_PATH = path.join(__dirname, 'prompt-deep.txt');

/**
 * 앱 ID 생성 (URL-safe)
 */
function generateAppId(platform, appName) {
  const safeName = appName
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const timestamp = Date.now();
  return `${platform}-${safeName}-${timestamp}`;
}

/**
 * Anthropic API로 분석 (타임아웃 포함)
 */
async function callClaude(prompt) {
  const API_TIMEOUT = 270000; // 4.5분 타임아웃 (앱당 5분 중 여유 확보)

  if (ANTHROPIC_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // AbortController로 타임아웃 구현
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      });
      clearTimeout(timeoutId);
      return response.content[0].text;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('API 타임아웃 (2.5분 초과)');
      }
      throw error;
    }
  } else {
    // CLI 모드 (로컬)
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
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
          resolve(stdout);
        } else {
          reject(new Error(`Claude CLI 실패: ${stderr}`));
        }
      });

      claude.on('error', reject);
      claude.stdin.write(prompt);
      claude.stdin.end();

      // 4.5분 타임아웃 (앱당 5분 중 여유 확보)
      setTimeout(() => {
        claude.kill();
        reject(new Error('CLI 타임아웃 (4.5분 초과)'));
      }, 270000);
    });
  }
}

/**
 * 단일 앱 심층 분석
 */
async function analyzeDeep(app, platform = 'ios') {
  console.log(`   🔬 심층 분석: ${app.name}`);

  // 1. 심층 분석 프롬프트 로드
  let promptDeep;
  try {
    promptDeep = await fs.readFile(PROMPT_DEEP_PATH, 'utf8');
  } catch (err) {
    console.error('   ⚠️ prompt-deep.txt 로드 실패:', err.message);
    throw err;
  }

  // 2. 경쟁앱 조사 (선택적)
  let competitorsInfo = '';
  try {
    console.log(`   📊 경쟁앱 조사 중...`);
    const competitors = await findCompetitors({
      name: app.name,
      category: app.category,
      description: app.idea_summary || ''
    }, { platform, limit: 5 });

    if (competitors && competitors.competitors.length > 0) {
      competitorsInfo = `
## 경쟁앱 정보 (자동 수집)
${JSON.stringify({
  competitors: competitors.competitors,
  marketGap: competitors.marketGap,
  keywords: competitors.keywords
}, null, 2)}
`;
    }
  } catch (err) {
    console.log(`   ⚠️ 경쟁앱 조사 스킵:`, err.message);
  }

  // 3. 전체 프롬프트 구성
  const fullPrompt = `
${promptDeep}

## 분석 대상
- 앱 이름: ${app.name}
- 개발사: ${app.developer || 'N/A'}
- 카테고리: ${app.category || 'N/A'}
- 플랫폼: ${platform === 'ios' ? 'iOS' : 'Android'}
- 앱스토어 URL: ${app.app_url || 'N/A'}
- 아이디어 요약: ${app.idea_summary || 'N/A'}

## 기본 분석 결과 (참고용)
${JSON.stringify({
  analysis: app.analysis,
  market: app.market,
  business: app.business,
  scores: app.scores,
  verdict: app.verdict
}, null, 2)}

${competitorsInfo}

위 앱을 심층 분석해줘. 마크다운 형식으로 출력.
`;

  // 4. Claude API 호출
  console.log(`   🤖 Claude 심층 분석 중...`);
  const result = await callClaude(fullPrompt);

  return result;
}

/**
 * 전체 앱 심층 분석 실행 (타임아웃 + 개별 저장)
 */
async function analyzeAllDeep(apps, platform) {
  const PER_APP_TIMEOUT = 300000; // 앱당 5분 타임아웃
  const RATE_LIMIT_DELAY = 10000; // API 레이트 리밋 방지 10초

  // 디렉토리 생성
  try {
    await fs.mkdir(DEEP_REPORTS_DIR, { recursive: true });
  } catch (err) {
    // 이미 존재하면 무시
  }

  const results = [];
  let successCount = 0;

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const appId = generateAppId(platform, app.name);
    const deepPath = path.join(DEEP_REPORTS_DIR, `${appId}.md`);

    console.log(`\n📄 [${i + 1}/${apps.length}] ${app.name}`);

    try {
      // 개별 앱 분석 (타임아웃 5분)
      const report = await Promise.race([
        analyzeDeep(app, platform),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('타임아웃 (5분 초과)')), PER_APP_TIMEOUT)
        )
      ]);

      // 즉시 저장 (실패해도 이미 저장된 건 유지)
      await fs.writeFile(deepPath, report, 'utf8');
      // 웹 폴더에도 저장 (Vercel 배포용)
      const webPath = path.join(WEB_REPORTS_DIR, `${appId}.md`);
      await fs.mkdir(WEB_REPORTS_DIR, { recursive: true });
      await fs.writeFile(webPath, report, 'utf8');
      console.log(`   ✅ 저장 완료: ${path.basename(deepPath)}`);
      successCount++;

      results.push({
        ...app,
        deep_report_id: appId
      });
    } catch (error) {
      console.error(`   ⚠️ 스킵: ${error.message}`);
      results.push({
        ...app,
        deep_report_id: null
      });
      // 실패해도 다음 앱 계속 진행
    }

    // API 레이트 리밋 방지 (10초 대기)
    if (i < apps.length - 1) {
      console.log(`   ⏳ 다음 앱까지 ${RATE_LIMIT_DELAY / 1000}초 대기...`);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  console.log(`\n📊 심층 분석 완료: ${successCount}/${apps.length}개 성공`);
  return results;
}

/**
 * 특정 앱만 심층 분석 (단독 실행용)
 */
async function analyzeOne(appName, platform = 'ios') {
  const app = {
    name: appName,
    category: 'Unknown',
    developer: 'Unknown',
    app_url: '',
    idea_summary: ''
  };

  const appId = generateAppId(platform, appName);
  const deepPath = path.join(DEEP_REPORTS_DIR, `${appId}.md`);

  try {
    await fs.mkdir(DEEP_REPORTS_DIR, { recursive: true });
    await fs.mkdir(WEB_REPORTS_DIR, { recursive: true });
    const report = await analyzeDeep(app, platform);
    await fs.writeFile(deepPath, report, 'utf8');
    // 웹 폴더에도 저장
    const webPath = path.join(WEB_REPORTS_DIR, `${appId}.md`);
    await fs.writeFile(webPath, report, 'utf8');
    console.log(`\n✅ 심층 분석 완료: ${deepPath}`);
    return { appId, path: deepPath };
  } catch (error) {
    console.error('❌ 심층 분석 실패:', error.message);
    throw error;
  }
}

// CLI 실행 지원
if (require.main === module) {
  const args = process.argv.slice(2);
  const appName = args[0];

  if (!appName) {
    console.log('사용법: node analyzeDeep.js "앱 이름" [ios|android]');
    console.log('예: node analyzeDeep.js "Flighty" ios');
    process.exit(1);
  }

  const platform = args[1] || 'ios';

  console.log('');
  console.log('═'.repeat(60));
  console.log('🔬 DailyApp 심층 분석');
  console.log('═'.repeat(60));
  console.log(`앱: ${appName}`);
  console.log(`플랫폼: ${platform}`);
  console.log('');

  analyzeOne(appName, platform)
    .then(result => {
      console.log('\n📄 리포트:', result.path);
    })
    .catch(err => {
      console.error('오류:', err);
      process.exit(1);
    });
}

module.exports = {
  analyzeDeep,
  analyzeAllDeep,
  analyzeOne,
  generateAppId
};
