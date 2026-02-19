/**
 * localLLM.js
 *
 * Local LLM (Ollama) 연동 모듈
 * - 앱 1차 필터링 (전체 스캔)
 * - 영어 요약 생성
 * - 토큰 비용 절감
 */

// Node.js 18 미만에서는 node-fetch 필요할 수 있음

// Ollama 설정
const OLLAMA_CONFIG = {
  host: '127.0.0.1',  // localhost 대신 IP 사용 (Windows 호환성)
  port: 11434,
  model: 'qwen2.5:7b-instruct-q5_K_M',  // 지시 따르기 좋은 모델
  timeout: 120000  // 2분 타임아웃
};

// 배치 설정
const BATCH_SIZE = 50;  // 한 번에 처리할 앱 수

/**
 * Ollama API 호출 (fetch 사용)
 */
async function callOllama(prompt) {
  const url = `http://${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}/api/generate`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_CONFIG.timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_CONFIG.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 2000
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    return json.response || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Ollama 타임아웃');
    }
    throw error;
  }
}

/**
 * 앱 배치 필터링 (점수 매기기)
 * @param {Array} apps - 앱 목록
 * @returns {Array} - 점수가 매겨진 앱 목록
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
    const result = await callOllama(prompt);

    // JSON 추출
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('  ⚠️ JSON 추출 실패, 기본 점수 사용');
      return apps.map((app, idx) => ({ ...app, llmScore: 5 }));
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
 * @param {Array} apps - 전체 앱 목록
 * @param {number} topN - 상위 N개 반환
 * @returns {Array} - 필터링된 앱 목록
 */
async function filterApps(apps, topN = 30) {
  console.log(`  🤖 Local LLM 필터링 시작 (${apps.length}개 → ${topN}개)`);

  const allScoredApps = [];
  const totalBatches = Math.ceil(apps.length / BATCH_SIZE);

  for (let i = 0; i < apps.length; i += BATCH_SIZE) {
    const batch = apps.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`     배치 ${batchNum}/${totalBatches} 처리 중...`);

    const scoredBatch = await scoreAppsBatch(batch);
    allScoredApps.push(...scoredBatch);

    // 배치 간 딜레이 (GPU 과열 방지)
    if (i + BATCH_SIZE < apps.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 점수순 정렬 후 상위 N개 반환
  const sorted = allScoredApps.sort((a, b) => b.llmScore - a.llmScore);
  const filtered = sorted.slice(0, topN);

  console.log(`  ✅ 필터링 완료: 상위 ${topN}개 선별 (최고점: ${filtered[0]?.llmScore || 0})`);

  return filtered;
}

/**
 * 앱 목록을 영어로 요약
 * @param {Array} apps - 앱 목록
 * @returns {Array} - 영어 요약된 앱 목록
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
    const result = await callOllama(prompt);

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
 * @param {Array} apps - 전체 앱 목록
 * @param {number} topN - 상위 N개
 * @returns {Array} - 필터링되고 영어로 요약된 앱 목록
 */
async function filterAndSummarize(apps, topN = 30) {
  // 1. 점수 기반 필터링
  const filtered = await filterApps(apps, topN);

  // 2. 영어 요약
  const summarized = await summarizeToEnglish(filtered);

  return summarized;
}

/**
 * Ollama 연결 테스트
 */
async function testConnection() {
  try {
    const result = await callOllama('Say "OK" if you can hear me.');
    return result.includes('OK') || result.length > 0;
  } catch (error) {
    return false;
  }
}

module.exports = {
  callOllama,
  scoreAppsBatch,
  filterApps,
  summarizeToEnglish,
  filterAndSummarize,
  testConnection,
  OLLAMA_CONFIG
};
