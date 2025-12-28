/**
 * send-kakao.js
 *
 * 카카오톡 나에게 보내기로 리포트 요약 전송
 */

require('dotenv').config();

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// 환경변수에서 설정 로드
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
const SITE_URL = process.env.SITE_URL || 'https://web-ten-delta-23.vercel.app';
const ENV_FILE = path.join(__dirname, '..', '.env');
const REPORT_FILE = path.join(__dirname, '..', 'output', 'report.json');

if (!KAKAO_REST_API_KEY) {
  console.error('❌ KAKAO_REST_API_KEY가 .env에 설정되지 않았습니다.');
  process.exit(1);
}

/**
 * HTTPS 요청 헬퍼
 */
function httpsRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * .env 파일 업데이트
 */
async function updateEnvToken(key, value) {
  let envContent = await fs.readFile(ENV_FILE, 'utf-8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  await fs.writeFile(ENV_FILE, envContent);
}

/**
 * 토큰 갱신
 */
async function refreshToken() {
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error('리프레시 토큰이 없습니다. npm run kakao:auth를 실행하세요.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: KAKAO_REST_API_KEY,
    client_secret: KAKAO_CLIENT_SECRET,
    refresh_token: refreshToken
  });

  const result = await httpsRequest('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, params.toString());

  if (result.data.error) {
    throw new Error('토큰 갱신 실패: ' + result.data.error_description);
  }

  // .env 업데이트
  await updateEnvToken('KAKAO_ACCESS_TOKEN', result.data.access_token);
  await updateEnvToken('KAKAO_TOKEN_EXPIRES_AT', String(Date.now() + (result.data.expires_in * 1000)));

  if (result.data.refresh_token) {
    await updateEnvToken('KAKAO_REFRESH_TOKEN', result.data.refresh_token);
  }

  return result.data.access_token;
}

/**
 * 유효한 토큰 가져오기
 */
async function getValidToken() {
  let accessToken = process.env.KAKAO_ACCESS_TOKEN;
  const expiresAt = parseInt(process.env.KAKAO_TOKEN_EXPIRES_AT || '0');

  if (!accessToken) {
    throw new Error('액세스 토큰이 없습니다. npm run kakao:auth를 실행하세요.');
  }

  // 토큰 만료 확인 (1분 여유)
  if (Date.now() > expiresAt - 60000) {
    console.log('🔄 토큰 갱신 중...');
    accessToken = await refreshToken();
    console.log('   ✅ 토큰 갱신 완료');
  }

  return accessToken;
}

/**
 * 리포트 요약 생성
 */
function createSummary(report) {
  const date = report.date || new Date().toISOString().split('T')[0];

  let text = `📱 오늘의 앱 아이디어\n${date}\n\n`;

  // iOS 앱
  if (report.ios && report.ios.length > 0) {
    text += `🍎 iOS TOP ${report.ios.length}\n`;
    report.ios.slice(0, 3).forEach((app, i) => {
      text += `${i + 1}. ${app.name}\n`;
      text += `   💡 ${app.idea_summary}\n`;
    });
    if (report.ios.length > 3) text += `   ...외 ${report.ios.length - 3}개\n`;
    text += '\n';
  }

  // Android 앱
  if (report.android && report.android.length > 0) {
    text += `🤖 Android TOP ${report.android.length}\n`;
    report.android.slice(0, 3).forEach((app, i) => {
      text += `${i + 1}. ${app.name}\n`;
      text += `   💡 ${app.idea_summary}\n`;
    });
    if (report.android.length > 3) text += `   ...외 ${report.android.length - 3}개\n`;
  }

  // 인사이트
  if (report.daily_insight) {
    text += `\n💡 ${report.daily_insight.action_item}`;
  }

  return text;
}

/**
 * 카카오톡 나에게 보내기
 */
async function sendToMe(accessToken, text, webUrl) {
  const template = {
    object_type: 'text',
    text: text + '\n\n🔗 ' + webUrl,
    link: {
      web_url: webUrl,
      mobile_web_url: webUrl
    }
  };

  const params = new URLSearchParams({
    template_object: JSON.stringify(template)
  });

  const result = await httpsRequest('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, params.toString());

  return result;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('');
  console.log('📨 카카오톡 나에게 보내기');
  console.log('═'.repeat(50));

  // 1. 토큰 확인
  console.log('🔐 토큰 확인 중...');
  const accessToken = await getValidToken();
  console.log('   ✅ 토큰 유효');

  // 2. 리포트 읽기
  console.log('📊 리포트 로드 중...');
  let report;
  try {
    const data = await fs.readFile(REPORT_FILE, 'utf-8');
    report = JSON.parse(data);
  } catch {
    throw new Error('리포트 파일이 없습니다. npm run analyze를 실행하세요.');
  }

  if (report.error || report.raw) {
    throw new Error('유효하지 않은 리포트입니다.');
  }
  console.log('   ✅ 리포트 로드 완료');

  // 3. 메시지 생성
  console.log('✍️  메시지 생성 중...');
  const summary = createSummary(report);

  // 4. 전송
  console.log('📤 전송 중...');
  const result = await sendToMe(accessToken, summary, SITE_URL);

  if (result.status === 200 && result.data.result_code === 0) {
    console.log('');
    console.log('═'.repeat(50));
    console.log('✅ 카카오톡 전송 완료!');
    console.log('   카카오톡 > 나와의 채팅을 확인하세요.');
    console.log('═'.repeat(50));
  } else {
    throw new Error(`전송 실패: ${JSON.stringify(result.data)}`);
  }
}

main().catch(err => {
  console.error('');
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
