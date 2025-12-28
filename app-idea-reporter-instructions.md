# 📱 앱 아이디어 리포터 프로젝트 - Claude Code 구현 지시서

## 🎯 프로젝트 개요

매일 아침 9시에 자동으로 iOS 앱스토어와 Google 플레이스토어의 신규 앱을 수집하고, AI가 아이디어가 좋은 앱 각 10개씩 선별하여 웹사이트에 게시하고 카카오톡으로 알림을 보내는 시스템을 구축한다.

### 핵심 요구사항
- iOS 앱스토어 신규 앱 중 아이디어 좋은 것 10개 선별
- Google 플레이스토어 신규 앱 중 아이디어 좋은 것 10개 선별
- Next.js 웹사이트에 일별 리포트 자동 게시
- 카카오톡 "나에게 보내기" API로 알림 발송
- 비용: 거의 무료 (Claude Max 플랜 사용, Vercel 무료 호스팅)

---

## 🏗️ 시스템 아키텍처

```
[로컬 PC - WSL2 Ubuntu - 매일 오전 9시 cron]
    │
    ├── 1️⃣ collect.js
    │   ├── Apple RSS API로 iOS 신규앱 수집
    │   └── google-play-scraper로 Android 신규앱 수집
    │   └── 출력: collected_apps.json
    │
    ├── 2️⃣ analyze.sh
    │   └── Claude CLI로 수집된 앱 분석 & TOP 10 선별
    │   └── 출력: report.json
    │
    ├── 3️⃣ save-report.js
    │   └── report.json을 Next.js 프로젝트의 data 폴더에 날짜별로 저장
    │
    ├── 4️⃣ deploy.sh
    │   └── git add, commit, push → Vercel 자동 배포
    │
    └── 5️⃣ send-kakao.js
        └── 카카오톡 "나에게 보내기" API로 알림 발송
```

---

## 📁 프로젝트 폴더 구조

```
app-idea-reporter/
│
├── scripts/                    # 자동화 스크립트
│   ├── collect.js              # 앱 데이터 수집
│   ├── analyze.sh              # Claude CLI 분석 실행
│   ├── save-report.js          # 리포트 저장
│   ├── send-kakao.js           # 카카오톡 알림
│   ├── run.sh                  # 전체 실행 스크립트
│   └── prompt.txt              # Claude 분석 프롬프트
│
├── web/                        # Next.js 웹사이트
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # 메인 페이지 (최신 리포트)
│   │   └── archive/
│   │       └── [date]/
│   │           └── page.tsx    # 날짜별 리포트 페이지
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── AppCard.tsx         # 앱 카드 컴포넌트
│   │   ├── ReportSection.tsx   # iOS/Android 섹션
│   │   └── ArchiveList.tsx     # 지난 리포트 목록
│   ├── data/
│   │   └── reports/            # 날짜별 리포트 JSON
│   │       ├── 2025-12-28.json
│   │       ├── 2025-12-27.json
│   │       └── ...
│   ├── lib/
│   │   └── getReports.ts       # 리포트 데이터 로딩 유틸
│   ├── package.json
│   ├── tailwind.config.js
│   └── next.config.js
│
├── output/                     # 임시 출력 폴더
│   ├── collected_apps.json
│   └── report.json
│
├── .env                        # 환경변수
├── .gitignore
├── package.json
└── README.md
```

---

## 📊 데이터 소스 상세

### 1. iOS 앱스토어 (Apple RSS - 공식, 무료)

**엔드포인트:**
```
https://rss.applemarketingtools.com/api/v2/kr/apps/top-free/50/apps.json
```

**카테고리별 URL 예시:**
- 전체: `/apps/top-free/50/apps.json`
- 생산성: `/apps/top-free/50/apps.json?genre=6007`
- 금융: `/apps/top-free/50/apps.json?genre=6015`
- 게임: `/apps/top-free/50/apps.json?genre=6014`

**응답 구조:**
```json
{
  "feed": {
    "results": [
      {
        "id": "앱ID",
        "name": "앱 이름",
        "artistName": "개발자명",
        "artworkUrl100": "아이콘 URL",
        "genres": [{"name": "카테고리"}],
        "url": "앱스토어 링크",
        "releaseDate": "출시일"
      }
    ]
  }
}
```

### 2. Google 플레이스토어 (google-play-scraper)

**npm 패키지:** `google-play-scraper`

**사용 코드:**
```javascript
const gplay = require('google-play-scraper');

// 신규 무료앱 수집
const apps = await gplay.list({
  category: gplay.category.APPLICATION,
  collection: gplay.collection.NEW_FREE,
  country: 'kr',
  lang: 'ko',
  num: 50,
  fullDetail: true
});
```

**반환 데이터:**
```json
{
  "appId": "com.example.app",
  "title": "앱 이름",
  "developer": "개발자명",
  "icon": "아이콘 URL",
  "genre": "카테고리",
  "url": "플레이스토어 링크",
  "released": "출시일",
  "description": "앱 설명",
  "score": 4.5
}
```

---

## 🔧 각 스크립트 상세 스펙

### 1. collect.js - 데이터 수집 스크립트

```javascript
/**
 * collect.js
 * 
 * 역할: iOS 앱스토어와 Google 플레이스토어에서 신규 앱 데이터를 수집
 * 출력: output/collected_apps.json
 * 
 * 수집 대상:
 * - iOS: 여러 카테고리에서 각 50개씩 (중복 제거)
 * - Android: 여러 카테고리에서 각 50개씩 (중복 제거)
 * 
 * 수집 카테고리:
 * - 전체 (무료 인기)
 * - 생산성
 * - 유틸리티
 * - 라이프스타일
 * - 금융
 * - 건강 및 피트니스
 */

// 필요한 패키지
const axios = require('axios');
const gplay = require('google-play-scraper');
const fs = require('fs').promises;
const path = require('path');

// iOS 카테고리 ID
const IOS_CATEGORIES = {
  ALL: '',
  PRODUCTIVITY: '6007',
  UTILITIES: '6002',
  LIFESTYLE: '6012',
  FINANCE: '6015',
  HEALTH_FITNESS: '6013'
};

// Android 카테고리
const ANDROID_CATEGORIES = [
  gplay.category.APPLICATION,
  gplay.category.PRODUCTIVITY,
  gplay.category.TOOLS,
  gplay.category.LIFESTYLE,
  gplay.category.FINANCE,
  gplay.category.HEALTH_AND_FITNESS
];

async function collectIOS() {
  // Apple RSS API로 각 카테고리별 앱 수집
  // 중복 제거 후 반환
}

async function collectAndroid() {
  // google-play-scraper로 각 카테고리별 앱 수집
  // 중복 제거 후 반환
}

async function main() {
  const iosApps = await collectIOS();
  const androidApps = await collectAndroid();
  
  const result = {
    collectedAt: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    ios: iosApps,
    android: androidApps
  };
  
  await fs.writeFile(
    path.join(__dirname, '../output/collected_apps.json'),
    JSON.stringify(result, null, 2)
  );
  
  console.log(`✅ 수집 완료: iOS ${iosApps.length}개, Android ${androidApps.length}개`);
}

main().catch(console.error);
```

### 2. prompt.txt - Claude 분석 프롬프트

```
당신은 앱 아이디어 분석 전문가입니다.

아래는 오늘 iOS 앱스토어와 Google 플레이스토어에서 수집한 신규/인기 앱 목록입니다.

각 플랫폼(iOS, Android)에서 **아이디어가 뛰어난 앱 10개씩** 선별하여 분석해주세요.

## 선정 기준 (중요도 순)
1. **참신한 아이디어**: 기존에 없던 새로운 접근 방식
2. **명확한 문제 해결**: 실제 사용자의 Pain Point를 해결
3. **시장 가능성**: 확장 가능하고 수익화 잠재력이 있음
4. **인디 개발자 참고 가치**: 개인 개발자가 영감을 받을 수 있는 것

## 제외 대상
- 대기업/대형 스튜디오의 앱 (삼성, 구글, 네이버, 카카오 등)
- 단순 클론 앱
- 도박/성인 관련 앱
- 아이디어보다 마케팅으로 순위에 오른 앱

## 출력 형식 (반드시 아래 JSON 형식으로만 출력)
```json
{
  "date": "YYYY-MM-DD",
  "ios": [
    {
      "rank": 1,
      "name": "앱 이름",
      "developer": "개발자명",
      "category": "카테고리",
      "icon": "아이콘 URL",
      "app_url": "앱스토어 링크",
      "idea_summary": "핵심 아이디어 한줄 요약 (30자 이내)",
      "problem_solved": "이 앱이 해결하는 문제",
      "why_good": "왜 좋은 아이디어인지 (50자 이내)",
      "reference_point": "인디 개발자가 참고할 포인트",
      "potential": "확장/수익화 가능성"
    }
  ],
  "android": [
    // 위와 동일한 구조
  ],
  "trend_insight": "오늘 수집된 앱들에서 발견한 트렌드 인사이트 (100자 이내)"
}
```

## 주의사항
- 반드시 유효한 JSON 형식으로만 출력하세요
- 마크다운 코드블록 없이 순수 JSON만 출력하세요
- 각 플랫폼별로 정확히 10개씩 선별하세요
- 중복 앱이 없도록 하세요

---

수집된 앱 데이터:
```

### 3. analyze.sh - Claude CLI 분석 실행

```bash
#!/bin/bash

# analyze.sh
# Claude CLI를 사용하여 수집된 앱 분석

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

INPUT_FILE="$PROJECT_DIR/output/collected_apps.json"
OUTPUT_FILE="$PROJECT_DIR/output/report.json"
PROMPT_FILE="$SCRIPT_DIR/prompt.txt"

# 프롬프트와 데이터 결합
FULL_PROMPT=$(cat "$PROMPT_FILE")
APP_DATA=$(cat "$INPUT_FILE")

# Claude CLI 실행
echo "$FULL_PROMPT"$'\n'"$APP_DATA" | claude --print > "$OUTPUT_FILE"

# JSON 유효성 검사
if jq empty "$OUTPUT_FILE" 2>/dev/null; then
    echo "✅ 분석 완료: $OUTPUT_FILE"
else
    echo "❌ JSON 파싱 오류 - 재시도 필요"
    exit 1
fi
```

### 4. save-report.js - 리포트 저장

```javascript
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
  const reportPath = path.join(__dirname, '../output/report.json');
  const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
  
  const date = report.date || new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '../web/data/reports');
  
  // 디렉토리 생성
  await fs.mkdir(outputDir, { recursive: true });
  
  // 날짜별 파일로 저장
  const outputPath = path.join(outputDir, `${date}.json`);
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  
  console.log(`✅ 리포트 저장 완료: ${outputPath}`);
}

main().catch(console.error);
```

### 5. send-kakao.js - 카카오톡 알림

```javascript
/**
 * send-kakao.js
 * 
 * 역할: 카카오톡 "나에게 보내기" API로 리포트 알림 발송
 * 
 * 필요한 환경변수:
 * - KAKAO_ACCESS_TOKEN: 카카오 액세스 토큰
 * - SITE_URL: 웹사이트 URL (예: https://app-trends.vercel.app)
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function sendKakaoMessage() {
  const reportPath = path.join(__dirname, '../output/report.json');
  const report = JSON.parse(await fs.readFile(reportPath, 'utf-8'));
  
  const accessToken = process.env.KAKAO_ACCESS_TOKEN;
  const siteUrl = process.env.SITE_URL || 'https://app-trends.vercel.app';
  
  // 메시지 템플릿 구성
  const ios1 = report.ios[0];
  const android1 = report.android[0];
  
  const message = {
    object_type: 'text',
    text: `📱 ${report.date} 앱 아이디어 리포트\n\n` +
          `🍎 iOS 1위: ${ios1.name}\n` +
          `→ ${ios1.idea_summary}\n\n` +
          `🤖 Android 1위: ${android1.name}\n` +
          `→ ${android1.idea_summary}\n\n` +
          `💡 ${report.trend_insight}`,
    link: {
      web_url: siteUrl,
      mobile_web_url: siteUrl
    },
    button_title: '전체 리포트 보기'
  };

  try {
    const response = await axios.post(
      'https://kapi.kakao.com/v2/api/talk/memo/default/send',
      `template_object=${encodeURIComponent(JSON.stringify(message))}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('✅ 카카오톡 알림 발송 완료');
    return response.data;
  } catch (error) {
    console.error('❌ 카카오톡 발송 실패:', error.response?.data || error.message);
    throw error;
  }
}

sendKakaoMessage().catch(console.error);
```

### 6. run.sh - 전체 실행 스크립트

```bash
#!/bin/bash

# run.sh
# 전체 파이프라인 실행 스크립트

set -e  # 에러 발생시 중단

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 앱 아이디어 리포터 시작 - $(date)"

# 1. 데이터 수집
echo "📥 1/5 앱 데이터 수집 중..."
cd "$PROJECT_DIR"
node scripts/collect.js

# 2. Claude 분석
echo "🤖 2/5 AI 분석 중..."
bash scripts/analyze.sh

# 3. 리포트 저장
echo "💾 3/5 리포트 저장 중..."
node scripts/save-report.js

# 4. Git 커밋 & 푸시 (Vercel 자동 배포)
echo "🚀 4/5 웹사이트 배포 중..."
cd "$PROJECT_DIR/web"
git add data/reports/
git commit -m "📊 $(date +%Y-%m-%d) 리포트 추가" || echo "변경사항 없음"
git push origin main

# 5. 카카오톡 알림
echo "📱 5/5 카카오톡 알림 발송 중..."
cd "$PROJECT_DIR"
node scripts/send-kakao.js

echo "✅ 완료! - $(date)"
```

---

## 🌐 Next.js 웹사이트 스펙

### 기술 스택
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **배포:** Vercel
- **데이터:** 정적 JSON 파일 (빌드 타임 로딩)

### 페이지 구조

#### 1. 메인 페이지 (`/`)
- 오늘(또는 최신) 리포트 표시
- iOS TOP 10 / Android TOP 10 섹션
- 트렌드 인사이트 표시
- 지난 리포트 링크

#### 2. 아카이브 페이지 (`/archive/[date]`)
- 특정 날짜의 리포트 표시
- 이전/다음 리포트 네비게이션

### 컴포넌트 상세

#### AppCard.tsx
```tsx
interface AppCardProps {
  rank: number;
  name: string;
  developer: string;
  category: string;
  icon: string;
  app_url: string;
  idea_summary: string;
  problem_solved: string;
  why_good: string;
  reference_point: string;
  potential: string;
}

// 카드 디자인:
// - 왼쪽: 순위 번호 (큰 숫자)
// - 아이콘 이미지
// - 앱 이름, 개발자, 카테고리
// - 아이디어 요약 (강조)
// - 펼치면: 상세 분석 내용
```

### 디자인 가이드라인
- **컬러 팔레트:**
  - Primary: #3B82F6 (Blue)
  - iOS 섹션: #000000 (Black)
  - Android 섹션: #34A853 (Green)
  - Background: #F9FAFB
  
- **폰트:**
  - 제목: Pretendard Bold
  - 본문: Pretendard Regular

- **반응형:**
  - Mobile First
  - 카드 그리드: 1열 (mobile) → 2열 (tablet) → 3열 (desktop)

---

## ⚙️ 환경변수 (.env)

```env
# 카카오톡 API
KAKAO_REST_API_KEY=your_kakao_rest_api_key
KAKAO_ACCESS_TOKEN=your_kakao_access_token
KAKAO_REFRESH_TOKEN=your_kakao_refresh_token

# 웹사이트 URL
SITE_URL=https://your-domain.com

# (선택) 디버그 모드
DEBUG=false
```

---

## 🔐 카카오톡 API 설정 가이드

### 1. 카카오 개발자 앱 생성
1. https://developers.kakao.com 접속
2. 내 애플리케이션 → 애플리케이션 추가
3. 앱 이름: "앱 아이디어 리포터"
4. REST API 키 복사

### 2. 카카오 로그인 설정
1. 앱 설정 → 카카오 로그인 → 활성화
2. Redirect URI 등록: `http://localhost:3000/oauth/kakao`
3. 동의항목 → "카카오톡 메시지 전송" 선택 필수

### 3. 액세스 토큰 발급
```
인증 URL:
https://kauth.kakao.com/oauth/authorize?client_id={REST_API_KEY}&redirect_uri={REDIRECT_URI}&response_type=code&scope=talk_message

→ 리다이렉트된 URL에서 code 파라미터 추출
→ 토큰 발급 API 호출하여 access_token, refresh_token 획득
```

### 4. 토큰 갱신 스크립트 (refresh-token.js)
```javascript
// 액세스 토큰 만료 시 리프레시 토큰으로 갱신
// 크론잡에 주기적 갱신 로직 추가 권장
```

---

## ⏰ Cron 설정 (WSL2 Ubuntu)

```bash
# crontab 편집
crontab -e

# 매일 오전 9시 실행
0 9 * * * cd /home/사용자명/app-idea-reporter && ./scripts/run.sh >> /home/사용자명/app-idea-reporter/logs/cron.log 2>&1
```

### WSL2 cron 활성화
```bash
# WSL2에서 cron 서비스 시작
sudo service cron start

# 자동 시작 설정 (.bashrc에 추가)
echo "sudo service cron start" >> ~/.bashrc
```

---

## 🚀 구현 순서 (단계별)

### Phase 1: 기본 세팅 (30분)
1. 프로젝트 폴더 구조 생성
2. package.json 초기화
3. 필요한 npm 패키지 설치
   - axios
   - google-play-scraper
   - dotenv

### Phase 2: 데이터 수집 (1시간)
1. collect.js 구현
2. iOS RSS API 연동 테스트
3. google-play-scraper 연동 테스트
4. 수집 결과 확인

### Phase 3: Claude 분석 연동 (30분)
1. prompt.txt 작성
2. analyze.sh 작성
3. Claude CLI 연동 테스트
4. JSON 출력 검증

### Phase 4: Next.js 웹사이트 (2시간)
1. Next.js 프로젝트 생성
2. Tailwind CSS 설정
3. 컴포넌트 구현 (Header, AppCard, ReportSection)
4. 메인 페이지 구현
5. 아카이브 페이지 구현
6. 로컬 테스트

### Phase 5: 배포 & 연동 (30분)
1. GitHub 저장소 생성 & 푸시
2. Vercel 연동
3. 배포 확인

### Phase 6: 카카오톡 연동 (1시간)
1. 카카오 개발자 앱 생성
2. 토큰 발급
3. send-kakao.js 구현
4. 발송 테스트

### Phase 7: 자동화 (30분)
1. run.sh 완성
2. cron 등록
3. 전체 파이프라인 테스트

---

## ⚠️ 주의사항 및 트러블슈팅

### 1. Claude CLI 인증
- Max 플랜 로그인 필수
- 세션 만료 시 재로그인 필요

### 2. google-play-scraper 제한
- 비공식 스크래퍼라 가끔 차단될 수 있음
- 백업: AppBrain RSS 또는 재시도 로직

### 3. 카카오 토큰 만료
- 액세스 토큰: 12시간
- 리프레시 토큰: 2개월
- 자동 갱신 로직 권장

### 4. WSL2 cron 이슈
- 윈도우 재시작 후 cron 서비스 재시작 필요
- 또는 Windows 작업 스케줄러로 WSL 명령 실행

### 5. Vercel 빌드 실패
- data/reports 폴더에 최소 1개 JSON 필요
- 빈 폴더면 빌드 에러 발생

---

## 📎 참고 자료

- Apple RSS: https://rss.applemarketingtools.com
- google-play-scraper: https://github.com/facundoolano/google-play-scraper
- Claude Code: https://docs.anthropic.com/claude-code
- 카카오 API: https://developers.kakao.com/docs/latest/ko/message/rest-api
- Next.js: https://nextjs.org/docs
- Vercel: https://vercel.com/docs
- Tailwind CSS: https://tailwindcss.com/docs

---

## ✅ 완료 체크리스트

- [ ] WSL2 + Node.js 설치
- [ ] Claude CLI 설치 & Max 플랜 로그인
- [ ] 프로젝트 폴더 구조 생성
- [ ] collect.js 구현 & 테스트
- [ ] prompt.txt 작성
- [ ] analyze.sh 구현 & 테스트
- [ ] save-report.js 구현
- [ ] Next.js 프로젝트 생성
- [ ] 웹사이트 컴포넌트 구현
- [ ] GitHub 저장소 생성
- [ ] Vercel 배포 연동
- [ ] 카카오 개발자 앱 생성
- [ ] 카카오 토큰 발급
- [ ] send-kakao.js 구현 & 테스트
- [ ] run.sh 완성
- [ ] cron 등록
- [ ] 전체 파이프라인 테스트
- [ ] (선택) 도메인 연결

---

*이 문서를 Claude Code에 입력하여 프로젝트를 구현하세요.*
*각 단계별로 "Phase N 구현해줘"라고 요청하면 됩니다.*
