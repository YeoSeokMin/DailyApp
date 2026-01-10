/**
 * linkDeepReports.js
 * 심층 분석 리포트를 report.json에 연결
 */

const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '../output/report.json');
const deepDir = path.join(__dirname, '../reports/deep');

// report.json 로드
const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

// 심층 분석 파일들 스캔
const files = fs.readdirSync(deepDir).filter(f => f.endsWith('.md'));

// 파일명에서 앱 이름 추출하여 매핑 (가장 최신 파일 사용)
const deepMap = {};
files.forEach(file => {
  const match = file.match(/^(ios|android)-(.+)-(\d+)\.md$/);
  if (match) {
    const [, platform, appSlug, timestamp] = match;
    const key = platform + '-' + appSlug;
    if (!deepMap[key] || parseInt(timestamp) > parseInt(deepMap[key].timestamp)) {
      deepMap[key] = { id: file.replace('.md', ''), timestamp };
    }
  }
});

console.log('발견된 심층 분석 리포트:', Object.keys(deepMap).length);

// iOS 앱에 deep_report_id 연결
let iosLinked = 0;
report.ios = report.ios.map((app, idx) => {
  const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const key = 'ios-' + slug;
  if (deepMap[key]) {
    console.log(`  iOS [${idx}] ${app.name} -> ${deepMap[key].id}`);
    iosLinked++;
    return { ...app, deep_report_id: deepMap[key].id };
  }
  return app;
});

// Android 앱에 deep_report_id 연결
let androidLinked = 0;
report.android = report.android.map((app, idx) => {
  const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const key = 'android-' + slug;
  if (deepMap[key]) {
    console.log(`  Android [${idx}] ${app.name} -> ${deepMap[key].id}`);
    androidLinked++;
    return { ...app, deep_report_id: deepMap[key].id };
  }
  return app;
});

// 저장
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n✅ 완료! iOS: ${iosLinked}개, Android: ${androidLinked}개 연결됨`);
