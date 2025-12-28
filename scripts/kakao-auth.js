/**
 * kakao-auth.js
 *
 * 카카오 OAuth 인증 및 토큰 발급
 * 최초 1회만 실행하면 됩니다.
 */

require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');

// 환경변수에서 설정 로드
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET;
const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 'http://localhost:3939/callback';
const ENV_FILE = path.join(__dirname, '..', '.env');

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
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * 인증 코드로 토큰 발급
 */
async function getToken(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_REST_API_KEY,
    client_secret: KAKAO_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code: code
  });

  const result = await httpsRequest('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, params.toString());

  return result;
}

/**
 * .env 파일에 토큰 저장
 */
async function saveTokenToEnv(tokenData) {
  let envContent = await fs.readFile(ENV_FILE, 'utf-8');

  const updates = {
    'KAKAO_ACCESS_TOKEN': tokenData.access_token,
    'KAKAO_REFRESH_TOKEN': tokenData.refresh_token,
    'KAKAO_TOKEN_EXPIRES_AT': String(Date.now() + (tokenData.expires_in * 1000)),
    'KAKAO_REFRESH_EXPIRES_AT': String(Date.now() + (tokenData.refresh_token_expires_in * 1000))
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  await fs.writeFile(ENV_FILE, envContent);
}

/**
 * 메인 실행
 */
async function main() {
  console.log('');
  console.log('🔐 카카오 OAuth 인증');
  console.log('═'.repeat(50));

  // 인증 URL 생성
  const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=talk_message`;

  console.log('');
  console.log('📱 브라우저에서 카카오 로그인을 진행하세요...');
  console.log('');

  // 콜백 서버 시작
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:3939`);

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>❌ 인증 실패</h1><p>다시 시도해주세요.</p>');
        console.error('❌ 인증 실패:', error);
        server.close();
        process.exit(1);
      }

      if (code) {
        try {
          // 토큰 발급
          const tokenData = await getToken(code);

          if (tokenData.error) {
            throw new Error(tokenData.error_description || tokenData.error);
          }

          // .env에 토큰 저장
          await saveTokenToEnv(tokenData);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>✅ 인증 완료!</h1><p>이 창을 닫아도 됩니다.</p>');

          console.log('');
          console.log('✅ 인증 성공!');
          console.log('   토큰이 .env 파일에 저장되었습니다.');
          console.log('');
          console.log('═'.repeat(50));

          server.close();
          process.exit(0);
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>❌ 토큰 발급 실패</h1><p>${err.message}</p>`);
          console.error('❌ 토큰 발급 실패:', err.message);
          server.close();
          process.exit(1);
        }
      }
    }
  });

  server.listen(3939, () => {
    // 브라우저 자동 열기
    const { exec } = require('child_process');
    const cmd = process.platform === 'win32' ? 'start' :
                process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${cmd} "${authUrl}"`);
  });
}

main().catch(console.error);
