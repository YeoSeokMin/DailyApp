# 오늘의 앱 아이디어

매일 iOS/Android 앱스토어에서 떠오르는 앱을 자동 수집하고, AI가 분석하여 인사이트를 제공하는 서비스입니다.

## 주요 기능

- **자동 수집** - iOS App Store, Google Play Store에서 신규/인기 앱 자동 수집
- **AI 분석** - 수집된 앱의 아이디어, 비즈니스 모델, 기술 스택 분석
- **심층 분석** - 상위 앱에 대한 경쟁사 조사 및 시장 분석
- **품질 점수** - 분석 결과의 신뢰도 평가
- **카카오톡 알림** - 매일 분석 결과를 카카오톡으로 전송
- **웹 대시보드** - 분석 결과를 시각적으로 확인

## 설치

```bash
npm install
```

## 환경 변수

`.env` 파일에 다음 변수를 설정하세요:

```
ANTHROPIC_API_KEY=your_api_key
KAKAO_ACCESS_TOKEN=your_kakao_token
KAKAO_REFRESH_TOKEN=your_kakao_refresh_token
```

## 사용법

### 전체 파이프라인 실행

```bash
# Windows
daily.bat

# 또는 개별 실행
npm run collect    # 앱 수집
npm run analyze    # AI 분석
npm run save       # 저장
npm run kakao:send # 카카오톡 전송
```

### 관리자 GUI

```bash
python manager.pyw
```

- **지금 실행** - 파이프라인 즉시 실행
- **중지** - 실행 중인 작업 중지
- **자동실행 켜기/끄기** - 매일 자동 실행 설정

### 웹 대시보드

```bash
cd web
npm run dev
```

`http://localhost:3000`에서 확인

## 프로젝트 구조

```
DailyApp/
├── scripts/           # 핵심 스크립트
│   ├── collect.js     # 앱 수집
│   ├── analyze.js     # AI 분석
│   ├── analyzeDeep.js # 심층 분석
│   ├── qualityScorer.js # 품질 평가
│   └── send-kakao.js  # 카카오톡 전송
├── prompts/           # AI 프롬프트
│   └── modules/       # 모듈식 프롬프트
├── output/            # 분석 결과
├── reports/           # 심층 분석 리포트
│   └── deep/          # 개별 앱 심층 분석
├── web/               # Next.js 웹 대시보드
└── manager.pyw        # 관리자 GUI
```

## 분석 결과 예시

각 앱에 대해 다음 정보를 분석합니다:

- **기본 정보** - 앱명, 개발사, 카테고리
- **아이디어 요약** - 핵심 아이디어 한줄 요약
- **문제/해결** - 해결하는 문제와 해결 방식
- **타겟 사용자** - 주요 타겟층
- **차별점** - 경쟁 앱 대비 차별점
- **시장 분석** - 경쟁사, 성장 가능성
- **수익 모델** - 수익화 방식, 가격 전략
- **개발 인사이트** - 예상 개발 기간, 비용, 기술 스택
- **점수** - 참신성, 필요성, 수익성 등 8개 항목

## 신뢰도 태그

모든 분석에는 신뢰도 태그가 포함됩니다:

- `[확인]` - 공식 정보에서 직접 확인된 내용
- `[추론]` - 관련 데이터 기반 합리적 추론
- `[추측]` - 정보 부족으로 인한 추측

## 라이선스

MIT
