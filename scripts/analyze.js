/**
 * analyze.js
 *
 * 역할: Claude CLI를 사용하여 수집된 앱 분석 & TOP 10 선별
 * 입력: output/collected_apps.json
 * 출력: output/report.json
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  console.log('🤖 Claude AI 분석 시작...');

  const projectDir = path.join(__dirname, '..');
  const inputPath = path.join(projectDir, 'output', 'collected_apps.json');
  const outputPath = path.join(projectDir, 'output', 'report.json');
  const promptPath = path.join(__dirname, 'prompt.txt');

  // 1. 프롬프트 읽기
  const promptTemplate = await fs.readFile(promptPath, 'utf-8');

  // 2. 수집된 앱 데이터 읽기
  const appData = await fs.readFile(inputPath, 'utf-8');

  // 3. 전체 프롬프트 구성
  const fullPrompt = promptTemplate + '\n' + appData;

  // 4. 임시 파일에 프롬프트 저장 (긴 프롬프트 처리)
  const tempPromptPath = path.join(projectDir, 'output', 'temp_prompt.txt');
  await fs.writeFile(tempPromptPath, fullPrompt, 'utf-8');

  console.log('📝 프롬프트 준비 완료');
  console.log(`   - 수집된 iOS 앱: ${JSON.parse(appData).iOS앱?.length || 0}개`);
  console.log(`   - 수집된 Android 앱: ${JSON.parse(appData).Android앱?.length || 0}개`);
  console.log('');
  console.log('⏳ Claude 분석 중... (1-2분 소요)');

  try {
    // 5. Claude CLI 실행 (Windows/Unix 호환)
    const isWindows = process.platform === 'win32';
    const command = isWindows
      ? `type "${tempPromptPath}" | claude --print`
      : `cat "${tempPromptPath}" | claude --print`;

    const result = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 5 * 60 * 1000, // 5분 타임아웃
      shell: true
    });

    // 6. JSON 파싱 시도
    let report;
    try {
      // JSON 부분만 추출 (앞뒤 불필요한 텍스트 제거)
      let jsonStr = result.trim();

      // 마크다운 코드블록 제거
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      // JSON 시작/끝 찾기
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
      }

      report = JSON.parse(jsonStr);
      console.log('✅ JSON 파싱 성공');
    } catch (parseError) {
      console.error('⚠️ JSON 파싱 실패, 원본 저장');
      report = { raw: result, error: parseError.message };
    }

    // 7. 결과 저장
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

    // 8. 임시 파일 삭제
    await fs.unlink(tempPromptPath).catch(() => {});

    console.log('');
    console.log('═'.repeat(50));
    console.log('✅ 분석 완료!');
    if (report.iOS) {
      console.log(`   - iOS TOP ${report.iOS.length}개 선별`);
    }
    if (report.Android) {
      console.log(`   - Android TOP ${report.Android.length}개 선별`);
    }
    console.log(`   - 저장: ${outputPath}`);
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Claude CLI 실행 실패:', error.message);

    // 에러 상세 정보 출력
    console.log('');
    console.log('💡 수동으로 실행하려면:');
    console.log(`   claude --print < "${tempPromptPath}"`);
    console.log('');
    console.log('   또는 Claude Code에서 직접 분석을 요청하세요.');

    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ 분석 실패:', error);
  process.exit(1);
});
