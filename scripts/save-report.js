/**
 * save-report.js
 *
 * 역할: 분석된 리포트를 Next.js 프로젝트의 data 폴더에 날짜별로 저장
 * 입력: output/report.json
 * 출력: web/data/reports/YYYY-MM-DD.json
 */

const fs = require('fs').promises;
const path = require('path');

async function main() {
  console.log('');
  console.log('💾 리포트 저장');
  console.log('═'.repeat(50));

  const projectDir = path.join(__dirname, '..');
  const reportPath = path.join(projectDir, 'output', 'report.json');

  // 1. 리포트 읽기
  let report;
  try {
    const data = await fs.readFile(reportPath, 'utf-8');
    report = JSON.parse(data);
  } catch (error) {
    console.error('❌ 리포트 읽기 실패:', error.message);
    process.exit(1);
  }

  // 2. 유효한 리포트인지 확인
  if (report.raw || report.error) {
    console.error('❌ 유효하지 않은 리포트입니다.');
    console.error('   analyze.js를 다시 실행해주세요.');
    process.exit(1);
  }

  // 3. 날짜 추출 (리포트에서 또는 오늘 날짜)
  const today = new Date();
  const dateStr = report.date ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 4. 출력 디렉토리 확인/생성
  const outputDir = path.join(projectDir, 'web', 'data', 'reports');
  await fs.mkdir(outputDir, { recursive: true });

  // 5. 날짜별 파일로 저장
  const outputPath = path.join(outputDir, `${dateStr}.json`);
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('✅ 저장 완료!');
  console.log(`   날짜: ${dateStr}`);
  console.log(`   파일: web/data/reports/${dateStr}.json`);

  if (report.ios) {
    console.log(`   iOS: ${report.ios.length}개 앱`);
  }
  if (report.android) {
    console.log(`   Android: ${report.android.length}개 앱`);
  }
  console.log('═'.repeat(50));
}

main().catch(error => {
  console.error('❌ 저장 실패:', error);
  process.exit(1);
});
