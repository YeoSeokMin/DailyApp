# DailyApp Prompt System

동적 프롬프트 조합 시스템

## 폴더 구조

```
prompts/
├── promptBuilder.js     # 프롬프트 조합 엔진
├── README.md
└── modules/
    ├── base.txt         # 기본 규칙 + Anti-Hallucination
    ├── core.txt         # [M-CORE] 기본 프로필
    ├── biz.txt          # [M-BIZ] 비즈니스 분석
    ├── user.txt         # [M-USER] 사용자 분석
    ├── market.txt       # [M-MARKET] 시장 분석
    ├── growth.txt       # [M-GROWTH] 성장 분석
    ├── korea.txt        # [M-KOREA] 한국 시장
    ├── game.txt         # [M-GAME] 게임 특화
    ├── fintech.txt      # [M-FINTECH] 핀테크 특화
    ├── social.txt       # [M-SOCIAL] 소셜 특화
    ├── health.txt       # [M-HEALTH] 헬스 특화
    ├── output-json.txt  # JSON 출력 포맷
    └── output-md.txt    # 마크다운 출력 포맷
```

## 사용법

### 코드에서 사용

```javascript
const { buildPrompt, presets } = require('./prompts/promptBuilder');

// 커스텀 조합
const prompt = buildPrompt({
  outputFormat: 'markdown',  // 'json' | 'markdown'
  includeKorea: true,        // 한국 시장 분석 포함
  category: 'Games',         // 카테고리별 특화 모듈
  depth: 'full'              // 'quick' | 'standard' | 'full'
});

// 프리셋 사용
const dailyPrompt = presets.daily();    // 자동 파이프라인용
const quickPrompt = presets.quick();    // 빠른 요약
const fullPrompt = presets.full();      // 전체 심층 분석
const gamePrompt = presets.game();      // 게임 특화
```

### CLI에서 사용

```bash
# 프리셋으로 프롬프트 생성
node prompts/promptBuilder.js full
node prompts/promptBuilder.js game
node prompts/promptBuilder.js quick

# 파일로 저장
node prompts/promptBuilder.js full > output_prompt.txt
```

## 깊이 옵션

| depth | 포함 모듈 | 용도 |
|-------|----------|------|
| `quick` | base, core | 빠른 개요 |
| `standard` | base, core, biz, user, market | 일반 분석 |
| `full` | base, core, biz, user, market, growth | 심층 분석 |

## 카테고리 매핑

| 카테고리 | 특화 모듈 |
|---------|----------|
| Games, 게임 | game.txt |
| Finance, Shopping, 금융 | fintech.txt |
| Social, Dating, Communication | social.txt |
| Health & Fitness, Medical | health.txt |

## 프리셋

| 프리셋 | 설명 | 출력 |
|-------|------|------|
| `daily` | 자동 파이프라인용 | JSON |
| `quick` | 빠른 요약 | Markdown |
| `full` | 전체 심층 분석 | Markdown |
| `game` | 게임 앱 특화 | Markdown |
| `fintech` | 핀테크 앱 특화 | Markdown |
| `social` | 소셜 앱 특화 | Markdown |
