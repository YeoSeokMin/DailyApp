/**
 * localLLM.js
 *
 * Codex CLI (gpt-5) 연동 모듈
 * - 앱 1차 필터링 (전체 스캔)
 * - 영어 요약 생성
 * - 토큰 비용 절감
 *
 * 기존 Ollama → Codex CLI로 교체
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Codex CLI 설정
const CODEX_CONFIG = {
  model: 'gpt-5',
  reasoningEffort: 'low',  // gpt-5는 xhigh 미지원, low로 충분
  timeout: 120000  // 2분 타임아웃
};

// 배치 설정
const BATCH_SIZE = 50;

/**
 * Codex CLI 호출
 * codex exec -m o4-mini --ephemeral -o tmpFile "prompt"
 */
async function callCodex(prompt) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `codex_out_${Date.now()}.txt`);

    // 프롬프트를 stdin으로 전달 (- 플래그)
    const args = [
      'exec',
      '-m', CODEX_CONFIG.model,
      '-c', `model_reasoning_effort="${CODEX_CONFIG.reasoningEffort}"`,
      '--ephemeral',
      '--skip-git-repo-check',
      '-o', tmpFile,
      '-'  // stdin에서 프롬프트 읽기
    ];

    const child = spawn('codex', args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: CODEX_CONFIG.timeout
    });

    // stdin으로 프롬프트 전달
    child.stdin.write(prompt);
    child.stdin.end();

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        if (fs.existsSync(tmpFile)) {
          const result = fs.readFileSync(tmpFile, 'utf-8').trim();
          fs.unlinkSync(tmpFile);  // cleanup
          resolve(result);
        } else if (code === 0) {
          resolve('');
        } else {
          reject(new Error(`Codex 종료 코드 ${code}: ${stderr.substring(0, 300)}`));
        }
      } catch (error) {
        reject(error);
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Codex 실행 실패: ${error.message}`));
    });

    // 타임아웃
    setTimeout(() => {
      child.kill();
      reject(new Error('Codex 타임아웃'));
    }, CODEX_CONFIG.timeout);
  });
}

/**
 * 앱 배치 필터링 (점수 매기기)
 */
async function scoreAppsBatch(apps) {
  const appList = apps.map((app, idx) =>
    `${idx + 1}. "${app.name}" | ${app.category || 'Unknown'} | ${app.developer || 'Unknown'}`
  ).join('\n');

  const prompt = `You are an app analyst. Score each app from 1-10 based on:
- Innovation potential (unique idea?)
- Indie developer friendliness (can a small team make this?)
- Market opportunity (underserved niche?)

EXCLUDE (score 1-2):
- Big company apps (Google, Meta, Samsung, Microsoft, etc.)
- Gambling/Casino apps
- Simple clones of existing apps
- Adult content

Apps to score:
${appList}

Output ONLY a JSON array with scores, no explanation:
[{"idx": 1, "score": 7}, {"idx": 2, "score": 3}, ...]`;

  try {
    const result = await callCodex(prompt);

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('  ⚠️ JSON 추출 실패, 기본 점수 사용');
      return apps.map(app => ({ ...app, llmScore: 5 }));
    }

    const scores = JSON.parse(jsonMatch[0]);
    const scoreMap = new Map(scores.map(s => [s.idx, s.score]));

    return apps.map((app, idx) => ({
      ...app,
      llmScore: scoreMap.get(idx + 1) || 5
    }));
  } catch (error) {
    console.log('  ⚠️ 배치 스코어링 실패:', error.message);
    return apps.map(app => ({ ...app, llmScore: 5 }));
  }
}

/**
 * 전체 앱 필터링 (배치 처리)
 */
async function filterApps(apps, topN = 30) {
  console.log(`  🤖 Codex (${CODEX_CONFIG.model}) 필터링 시작 (${apps.length}개 → ${topN}개)`);

  const allScoredApps = [];
  const totalBatches = Math.ceil(apps.length / BATCH_SIZE);

  for (let i = 0; i < apps.length; i += BATCH_SIZE) {
    const batch = apps.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`     배치 ${batchNum}/${totalBatches} 처리 중...`);

    const scoredBatch = await scoreAppsBatch(batch);
    allScoredApps.push(...scoredBatch);

    // 배치 간 딜레이 (rate limit 방지)
    if (i + BATCH_SIZE < apps.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const sorted = allScoredApps.sort((a, b) => b.llmScore - a.llmScore);
  const filtered = sorted.slice(0, topN);

  console.log(`  ✅ 필터링 완료: 상위 ${topN}개 선별 (최고점: ${filtered[0]?.llmScore || 0})`);

  return filtered;
}

/**
 * 앱 목록을 영어로 요약
 */
async function summarizeToEnglish(apps) {
  console.log(`  🌐 영어 요약 생성 중 (${apps.length}개)...`);

  const appList = apps.map((app, idx) =>
    `${idx + 1}. Name: "${app.name}" | Category: ${app.category || 'Unknown'} | Developer: ${app.developer || 'Unknown'} | Description: ${(app.description || '').substring(0, 100)}`
  ).join('\n');

  const prompt = `Summarize each app in English for analysis. Output JSON array:

Apps:
${appList}

Output format (JSON only, no explanation):
[
  {"idx": 1, "name_en": "App Name", "category_en": "Category", "summary_en": "Brief 10-word summary of what this app does"},
  ...
]`;

  try {
    const result = await callCodex(prompt);

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('  ⚠️ 영어 요약 실패, 원본 사용');
      return apps;
    }

    const summaries = JSON.parse(jsonMatch[0]);
    const summaryMap = new Map(summaries.map(s => [s.idx, s]));

    const result_apps = apps.map((app, idx) => {
      const summary = summaryMap.get(idx + 1) || {};
      return {
        ...app,
        name_en: summary.name_en || app.name,
        category_en: summary.category_en || app.category,
        summary_en: summary.summary_en || ''
      };
    });

    console.log('  ✅ 영어 요약 완료');
    return result_apps;
  } catch (error) {
    console.log('  ⚠️ 영어 요약 실패:', error.message);
    return apps;
  }
}

/**
 * 전체 파이프라인: 필터링 + 영어 요약
 */
async function filterAndSummarize(apps, topN = 30) {
  const filtered = await filterApps(apps, topN);
  const summarized = await summarizeToEnglish(filtered);
  return summarized;
}

/**
 * Codex CLI 연결 테스트
 */
async function testConnection() {
  try {
    const result = await callCodex('Reply with only the word OK');
    return result.includes('OK') || result.length > 0;
  } catch (error) {
    console.log('  ⚠️ Codex CLI 연결 실패:', error.message);
    return false;
  }
}

module.exports = {
  callCodex,
  scoreAppsBatch,
  filterApps,
  summarizeToEnglish,
  filterAndSummarize,
  testConnection,
  CODEX_CONFIG
};
