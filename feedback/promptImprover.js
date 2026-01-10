/**
 * promptImprover.js
 *
 * 피드백 기반 프롬프트 자동 개선 시스템
 * - 패턴 감지 → 프롬프트 수정
 * - 개선 이력 관리
 * - 롤백 지원
 */

const fs = require('fs').promises;
const path = require('path');
const { detectPatterns, getFeedbacks, resolveFeedback, FEEDBACK_CATEGORIES } = require('./feedbackCollector');
const { generateRecommendations, SECTION_TO_MODULE } = require('./feedbackAnalyzer');

const PROMPTS_DIR = path.join(__dirname, '../prompts/modules');
const IMPROVEMENTS_LOG = path.join(__dirname, 'data', 'improvements_log.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'prompt_backups');

// 자동 개선 임계값
const AUTO_IMPROVE_THRESHOLD = 3; // 같은 이슈 3회 이상 시 자동 개선

/**
 * 개선 로그 로드
 */
async function loadImprovementsLog() {
  try {
    const data = await fs.readFile(IMPROVEMENTS_LOG, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { improvements: [], lastRun: null };
  }
}

/**
 * 개선 로그 저장
 */
async function saveImprovementsLog(log) {
  log.lastRun = new Date().toISOString();
  await fs.mkdir(path.dirname(IMPROVEMENTS_LOG), { recursive: true });
  await fs.writeFile(IMPROVEMENTS_LOG, JSON.stringify(log, null, 2), 'utf8');
}

/**
 * 프롬프트 모듈 백업
 */
async function backupModule(moduleName) {
  const sourcePath = path.join(PROMPTS_DIR, moduleName);
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `${moduleName}.${timestamp}.bak`);

  try {
    const content = await fs.readFile(sourcePath, 'utf8');
    await fs.writeFile(backupPath, content, 'utf8');
    return backupPath;
  } catch (err) {
    console.error(`백업 실패: ${moduleName}`, err.message);
    return null;
  }
}

/**
 * 프롬프트 모듈에 경고/지침 추가
 */
async function appendToPrompt(moduleName, content) {
  const modulePath = path.join(PROMPTS_DIR, moduleName);

  try {
    const existing = await fs.readFile(modulePath, 'utf8');

    // 이미 같은 내용이 있으면 스킵
    if (existing.includes(content.trim())) {
      console.log(`  ⏭️ 이미 존재하는 지침: ${moduleName}`);
      return false;
    }

    // 백업
    await backupModule(moduleName);

    // "---" 구분선 전에 삽입 (있으면)
    let newContent;
    const dividerIndex = existing.lastIndexOf('\n---\n');

    if (dividerIndex > -1) {
      newContent = existing.slice(0, dividerIndex) + '\n\n' + content + existing.slice(dividerIndex);
    } else {
      newContent = existing + '\n\n' + content;
    }

    await fs.writeFile(modulePath, newContent, 'utf8');
    console.log(`  ✅ 프롬프트 업데이트: ${moduleName}`);
    return true;
  } catch (err) {
    console.error(`프롬프트 수정 실패: ${moduleName}`, err.message);
    return false;
  }
}

/**
 * 개선 지침 생성
 */
function generateInstruction(pattern, feedbacks) {
  const category = pattern.category;
  const keywords = pattern.keywords.map(k => k.word).join(', ');

  // 피드백 내용에서 구체적인 문제 추출
  const issues = feedbacks
    .slice(0, 3)
    .map(f => f.content)
    .join('; ');

  const templates = {
    [FEEDBACK_CATEGORIES.ACCURACY]: {
      title: '정확성 검증 필수',
      body: `다음 항목 작성 시 반드시 공식 출처 확인:\n- 관련 키워드: ${keywords}\n- 보고된 문제: ${issues}\n- 확인 불가 시 [추측] 태그 필수 사용`
    },
    [FEEDBACK_CATEGORIES.HALLUCINATION]: {
      title: '허위 정보 생성 금지',
      body: `다음 유형의 정보는 절대 추측하지 말 것:\n- 관련 키워드: ${keywords}\n- 사례: ${issues}\n- 모르면 "정보 없음" 또는 "확인 필요" 표기`
    },
    [FEEDBACK_CATEGORIES.MISSING]: {
      title: '필수 포함 항목',
      body: `다음 정보는 반드시 포함:\n- ${keywords}\n- 누락 시 분석 불완전으로 간주`
    },
    [FEEDBACK_CATEGORIES.OUTDATED]: {
      title: '최신 정보 확인',
      body: `다음 항목은 최신 상태 기준으로 작성:\n- ${keywords}\n- 과거 정보는 날짜와 함께 명시`
    },
    [FEEDBACK_CATEGORIES.DEPTH]: {
      title: '심층 분석 요구',
      body: `다음 항목에 대해 더 깊은 분석 필요:\n- ${keywords}\n- 단순 나열이 아닌 인사이트 포함`
    }
  };

  const template = templates[category] || {
    title: '품질 개선 필요',
    body: `다음 이슈 주의:\n- ${issues}`
  };

  return `### ⚠️ ${template.title}\n${template.body}`;
}

/**
 * 자동 개선 실행
 */
async function runAutoImprovement(options = {}) {
  const {
    threshold = AUTO_IMPROVE_THRESHOLD,
    dryRun = false
  } = options;

  console.log('🔧 프롬프트 자동 개선 시작...\n');

  // 1. 패턴 감지
  const patterns = await detectPatterns(threshold);

  if (patterns.length === 0) {
    console.log('✅ 개선이 필요한 반복 패턴이 없습니다.');
    return { improved: 0, patterns: [] };
  }

  console.log(`📊 ${patterns.length}개 패턴 감지됨\n`);

  const log = await loadImprovementsLog();
  const improvements = [];

  // 2. 각 패턴에 대해 개선 적용
  for (const pattern of patterns) {
    console.log(`\n[${pattern.category}/${pattern.section}] ${pattern.count}회 반복`);
    console.log(`  키워드: ${pattern.keywords.map(k => k.word).join(', ')}`);

    const targetModule = SECTION_TO_MODULE[pattern.section];

    if (!targetModule) {
      console.log(`  ⚠️ 대상 모듈을 찾을 수 없음`);
      continue;
    }

    // 이미 적용된 개선인지 확인
    const existingImprovement = log.improvements.find(imp =>
      imp.category === pattern.category &&
      imp.section === pattern.section &&
      new Date(imp.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7일 이내
    );

    if (existingImprovement) {
      console.log(`  ⏭️ 최근 이미 적용됨 (${existingImprovement.timestamp})`);
      continue;
    }

    // 개선 지침 생성
    const instruction = generateInstruction(pattern, pattern.feedbacks);
    console.log(`  📝 생성된 지침:\n${instruction.split('\n').map(l => '     ' + l).join('\n')}`);

    if (dryRun) {
      console.log(`  🔍 [DRY RUN] 실제 적용하지 않음`);
      continue;
    }

    // 프롬프트에 추가
    const applied = await appendToPrompt(targetModule, instruction);

    if (applied) {
      const improvement = {
        id: `imp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        category: pattern.category,
        section: pattern.section,
        targetModule,
        instruction,
        feedbackCount: pattern.count,
        feedbackIds: pattern.feedbacks.map(f => f.id)
      };

      improvements.push(improvement);
      log.improvements.push(improvement);

      // 관련 피드백 해결 처리
      for (const feedback of pattern.feedbacks) {
        await resolveFeedback(feedback.id, true);
      }

      console.log(`  ✅ 개선 적용 완료`);
    }
  }

  // 3. 로그 저장
  await saveImprovementsLog(log);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 자동 개선 완료: ${improvements.length}건 적용`);

  return {
    improved: improvements.length,
    patterns: patterns.length,
    improvements
  };
}

/**
 * 수동 개선 적용
 */
async function applyManualImprovement(options) {
  const {
    moduleName,
    title,
    instruction,
    feedbackIds = []
  } = options;

  if (!moduleName || !instruction) {
    throw new Error('moduleName과 instruction은 필수입니다.');
  }

  console.log(`📝 수동 개선 적용: ${moduleName}`);

  const content = title
    ? `### ⚠️ ${title}\n${instruction}`
    : instruction;

  const applied = await appendToPrompt(moduleName, content);

  if (applied) {
    const log = await loadImprovementsLog();
    const improvement = {
      id: `imp_manual_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'manual',
      targetModule: moduleName,
      instruction: content,
      feedbackIds
    };

    log.improvements.push(improvement);
    await saveImprovementsLog(log);

    // 관련 피드백 해결 처리
    for (const fbId of feedbackIds) {
      await resolveFeedback(fbId, true);
    }

    return improvement;
  }

  return null;
}

/**
 * 롤백 (마지막 개선 취소)
 */
async function rollback(moduleName) {
  const backups = await fs.readdir(BACKUP_DIR).catch(() => []);
  const moduleBackups = backups
    .filter(f => f.startsWith(moduleName) && f.endsWith('.bak'))
    .sort()
    .reverse();

  if (moduleBackups.length === 0) {
    console.log(`⚠️ ${moduleName}에 대한 백업이 없습니다.`);
    return false;
  }

  const latestBackup = moduleBackups[0];
  const backupPath = path.join(BACKUP_DIR, latestBackup);
  const targetPath = path.join(PROMPTS_DIR, moduleName);

  try {
    const backupContent = await fs.readFile(backupPath, 'utf8');
    await fs.writeFile(targetPath, backupContent, 'utf8');
    console.log(`✅ ${moduleName} 롤백 완료 (${latestBackup})`);

    // 사용된 백업 삭제
    await fs.unlink(backupPath);
    return true;
  } catch (err) {
    console.error(`롤백 실패:`, err.message);
    return false;
  }
}

/**
 * 개선 이력 조회
 */
async function getImprovementHistory(limit = 10) {
  const log = await loadImprovementsLog();
  return log.improvements.slice(-limit).reverse();
}

/**
 * 상태 요약
 */
async function getStatus() {
  const log = await loadImprovementsLog();
  const patterns = await detectPatterns(AUTO_IMPROVE_THRESHOLD);

  return {
    totalImprovements: log.improvements.length,
    lastRun: log.lastRun,
    pendingPatterns: patterns.length,
    recentImprovements: log.improvements.slice(-5).reverse()
  };
}

// CLI 지원
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'run') {
    const dryRun = args.includes('--dry-run');
    runAutoImprovement({ dryRun }).then(result => {
      console.log('\n결과:', JSON.stringify(result, null, 2));
    });
  } else if (command === 'status') {
    getStatus().then(status => {
      console.log('\n📊 상태:');
      console.log(JSON.stringify(status, null, 2));
    });
  } else if (command === 'history') {
    getImprovementHistory().then(history => {
      console.log('\n📜 개선 이력:');
      history.forEach((imp, i) => {
        console.log(`${i + 1}. [${imp.timestamp}] ${imp.targetModule}`);
        console.log(`   ${imp.instruction.slice(0, 50)}...`);
      });
    });
  } else if (command === 'rollback') {
    const moduleName = args[1];
    if (!moduleName) {
      console.log('Usage: node promptImprover.js rollback <module.txt>');
    } else {
      rollback(moduleName);
    }
  } else if (command === 'manual') {
    // 예: node promptImprover.js manual market.txt "경쟁앱 검증" "앱스토어 검색 결과 기반으로만 작성"
    const [_, moduleName, title, instruction] = args;
    if (!moduleName || !instruction) {
      console.log('Usage: node promptImprover.js manual <module.txt> "<title>" "<instruction>"');
    } else {
      applyManualImprovement({ moduleName, title, instruction }).then(result => {
        console.log('적용 완료:', result);
      });
    }
  } else {
    console.log('Usage: node promptImprover.js [run|status|history|rollback|manual]');
    console.log('  run [--dry-run]  : 자동 개선 실행');
    console.log('  status           : 현재 상태 확인');
    console.log('  history          : 개선 이력 조회');
    console.log('  rollback <module>: 모듈 롤백');
    console.log('  manual ...       : 수동 개선 적용');
  }
}

module.exports = {
  runAutoImprovement,
  applyManualImprovement,
  rollback,
  getImprovementHistory,
  getStatus,
  appendToPrompt,
  backupModule
};
