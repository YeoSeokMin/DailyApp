const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, 'modules');

/**
 * 동적 프롬프트 조합 시스템
 * @param {Object} options
 * @param {string} options.outputFormat - 'json' | 'markdown' (default: 'markdown')
 * @param {boolean} options.includeKorea - 한국 시장 분석 포함 (default: true)
 * @param {string} options.category - 앱 카테고리 (자동 감지 또는 명시)
 * @param {string} options.depth - 'quick' | 'standard' | 'full' (default: 'full')
 * @returns {string} 조합된 프롬프트
 */
function buildPrompt(options = {}) {
  const {
    outputFormat = 'markdown',
    includeKorea = true,
    category = null,
    depth = 'full'
  } = options;

  let prompt = '';
  const loadedModules = [];

  // 1. 기본 규칙 (항상 포함)
  prompt += loadModule('base');
  loadedModules.push('base');

  // 2. 깊이에 따른 모듈 선택
  if (depth === 'quick') {
    // Quick: 기본 프로필만
    prompt += loadModule('core');
    loadedModules.push('core');
  } else if (depth === 'standard') {
    // Standard: 핵심 4개 모듈
    prompt += loadModule('core');
    prompt += loadModule('biz');
    prompt += loadModule('user');
    prompt += loadModule('market');
    loadedModules.push('core', 'biz', 'user', 'market');
  } else {
    // Full: 모든 기본 모듈
    prompt += loadModule('core');
    prompt += loadModule('biz');
    prompt += loadModule('user');
    prompt += loadModule('market');
    prompt += loadModule('growth');
    loadedModules.push('core', 'biz', 'user', 'market', 'growth');
  }

  // 3. 한국 시장 분석 (선택)
  if (includeKorea) {
    prompt += loadModule('korea');
    loadedModules.push('korea');
  }

  // 4. 카테고리별 특화 모듈 (선택)
  if (category) {
    const catModule = getCategoryModule(category);
    if (catModule) {
      prompt += loadModule(catModule);
      loadedModules.push(catModule);
    }
  }

  // 5. 출력 포맷
  let outputModule;
  if (outputFormat === 'daily') {
    outputModule = 'output-daily';
  } else if (outputFormat === 'json') {
    outputModule = 'output-json';
  } else {
    outputModule = 'output-md';
  }
  prompt += loadModule(outputModule);
  loadedModules.push(outputModule);

  // 메타 정보 추가
  const meta = `\n<!-- Prompt built with modules: [${loadedModules.join(', ')}] -->\n`;

  return prompt + meta;
}

/**
 * 모듈 파일 로드
 */
function loadModule(name) {
  const filePath = path.join(MODULES_DIR, `${name}.txt`);
  try {
    return fs.readFileSync(filePath, 'utf8') + '\n';
  } catch (err) {
    console.warn(`[promptBuilder] Module not found: ${name}`);
    return '';
  }
}

/**
 * 카테고리 → 모듈 매핑
 */
function getCategoryModule(category) {
  const mapping = {
    // 게임
    'Games': 'game',
    'Game': 'game',
    '게임': 'game',

    // 금융
    'Finance': 'fintech',
    'Shopping': 'fintech',
    '금융': 'fintech',
    '쇼핑': 'fintech',

    // 소셜
    'Social Networking': 'social',
    'Social': 'social',
    'Dating': 'social',
    'Communication': 'social',
    '소셜 네트워킹': 'social',
    '커뮤니케이션': 'social',

    // 건강
    'Health & Fitness': 'health',
    'Health': 'health',
    'Medical': 'health',
    '건강 및 피트니스': 'health',
    '의료': 'health',

    // 생산성 (별도 모듈 없음, 기본 분석)
    'Productivity': null,
    'Utilities': null,
    'Business': null
  };

  return mapping[category] || null;
}

/**
 * 사용 가능한 모듈 목록 반환
 */
function listModules() {
  try {
    const files = fs.readdirSync(MODULES_DIR);
    return files
      .filter(f => f.endsWith('.txt'))
      .map(f => f.replace('.txt', ''));
  } catch (err) {
    return [];
  }
}

/**
 * 프리셋 프롬프트 생성
 */
const presets = {
  // 매일 자동 파이프라인용 (기존 prompt.txt 대체)
  daily: () => buildPrompt({
    outputFormat: 'daily',
    includeKorea: true,
    depth: 'standard'
  }),

  // 빠른 요약
  quick: () => buildPrompt({
    outputFormat: 'markdown',
    includeKorea: false,
    depth: 'quick'
  }),

  // 전체 심층 분석
  full: () => buildPrompt({
    outputFormat: 'markdown',
    includeKorea: true,
    depth: 'full'
  }),

  // 게임 앱 특화
  game: () => buildPrompt({
    outputFormat: 'markdown',
    includeKorea: true,
    category: 'Games',
    depth: 'full'
  }),

  // 핀테크 앱 특화
  fintech: () => buildPrompt({
    outputFormat: 'markdown',
    includeKorea: true,
    category: 'Finance',
    depth: 'full'
  }),

  // 소셜 앱 특화
  social: () => buildPrompt({
    outputFormat: 'markdown',
    includeKorea: true,
    category: 'Social',
    depth: 'full'
  })
};

// CLI 실행 지원
if (require.main === module) {
  const args = process.argv.slice(2);
  const presetName = args[0] || 'full';

  if (presets[presetName]) {
    console.log(presets[presetName]());
  } else {
    console.log('Available presets:', Object.keys(presets).join(', '));
  }
}

module.exports = {
  buildPrompt,
  loadModule,
  getCategoryModule,
  listModules,
  presets
};
