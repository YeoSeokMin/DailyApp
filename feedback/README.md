# DailyApp Feedback System

피드백 기반 프롬프트 자동 개선 시스템

## 아키텍처

```
사용자 피드백
     ↓
[feedbackCollector] → 수집 & 분류 → feedback_log.json
     ↓
[feedbackAnalyzer] → 패턴 감지 & 분석
     ↓
[promptImprover] → 프롬프트 자동 수정 → prompts/modules/*.txt
```

## 파일 구조

```
feedback/
├── feedbackCollector.js   # 피드백 수집
├── feedbackAnalyzer.js    # 피드백 분석
├── promptImprover.js      # 프롬프트 자동 개선
├── README.md
└── data/
    ├── feedback_log.json     # 피드백 저장소
    ├── improvements_log.json # 개선 이력
    └── prompt_backups/       # 프롬프트 백업
```

## 사용법

### 1. 피드백 수집

```javascript
const { collectFeedback, quickFeedback } = require('./feedback/feedbackCollector');

// 상세 피드백
await collectFeedback({
  appName: 'Flighty',
  category: 'accuracy',      // accuracy, hallucination, missing, outdated, format, depth
  section: 'market',         // core, biz, user, market, growth, insight, korea
  content: '경쟁앱 FlightAware가 실제로는 광고 있음',
  actual: '광고 없음으로 표기됨',
  severity: 4                // 1-5 (5가 가장 심각)
});

// 빠른 피드백
await quickFeedback.inaccurate('Flighty', 'market', '경쟁앱 정보 틀림');
await quickFeedback.hallucinated('Flighty', 'biz', 'AI가 매출 수치 지어냄', '연매출 1억 달러');
await quickFeedback.missing('Flighty', 'korea', '한국 결제 수단 정보 누락', '카카오페이 지원 여부');
await quickFeedback.wrongCompetitor('Flighty', 'TripIt 기능 오류', '오프라인 지원 X → O');
```

### 2. 피드백 분석

```bash
# 전체 리포트
node feedback/feedbackAnalyzer.js report

# 특정 섹션 분석
node feedback/feedbackAnalyzer.js section market

# 개선 제안 보기
node feedback/feedbackAnalyzer.js recommendations
```

```javascript
const { generateAnalysisReport, analyzeSection } = require('./feedback/feedbackAnalyzer');

const report = await generateAnalysisReport();
console.log(report.recommendations);  // 개선 제안
console.log(report.patterns);         // 반복 패턴
console.log(report.trends);           // 트렌드
```

### 3. 프롬프트 자동 개선

```bash
# 상태 확인
node feedback/promptImprover.js status

# 테스트 실행 (실제 수정 안 함)
node feedback/promptImprover.js run --dry-run

# 실제 자동 개선 실행
node feedback/promptImprover.js run

# 개선 이력 조회
node feedback/promptImprover.js history

# 롤백
node feedback/promptImprover.js rollback market.txt

# 수동 개선
node feedback/promptImprover.js manual market.txt "경쟁앱 검증" "앱스토어 검색 결과 기반으로만"
```

## 자동 개선 플로우

```
1. 사용자가 "Flighty 분석"에서 "경쟁앱 정보 틀림" 피드백 제출
2. 같은 카테고리(accuracy) + 섹션(market) 피드백 3번 누적
3. promptImprover가 패턴 감지
4. market.txt에 자동 추가:

   ### ⚠️ 정확성 검증 필수
   다음 항목 작성 시 반드시 공식 출처 확인:
   - 관련 키워드: 경쟁앱, flightaware, tripit
   - 보고된 문제: 경쟁앱 정보 틀림; FlightAware 광고 정보 오류
   - 확인 불가 시 [추측] 태그 필수 사용

5. 관련 피드백 자동으로 "해결됨" 처리
```

## 피드백 카테고리

| 카테고리 | 설명 | 심각도 |
|---------|------|--------|
| `accuracy` | 정보가 틀림 | 4 |
| `hallucination` | AI가 지어냄 | 5 |
| `missing` | 정보 누락 | 3 |
| `outdated` | 오래된 정보 | 3 |
| `format` | 형식 문제 | 2 |
| `depth` | 분석이 얕음 | 2 |
| `relevance` | 관련 없는 내용 | 2 |

## 섹션 → 모듈 매핑

| 섹션 | 프롬프트 모듈 |
|------|--------------|
| `core` | core.txt |
| `biz` | biz.txt |
| `user` | user.txt |
| `market` | market.txt |
| `growth` | growth.txt |
| `insight` | output-md.txt |
| `korea` | korea.txt |
| `overall` | base.txt |

## 임계값 설정

```javascript
// promptImprover.js
const AUTO_IMPROVE_THRESHOLD = 3; // 같은 이슈 3회 이상 시 자동 개선

// 변경하려면:
runAutoImprovement({ threshold: 5 }); // 5회 이상으로 변경
```

## 안전장치

1. **자동 백업**: 모든 수정 전 원본 백업
2. **중복 방지**: 같은 지침 중복 추가 방지
3. **7일 쿨다운**: 같은 패턴 7일 내 재적용 방지
4. **롤백 지원**: 언제든 이전 상태로 복원 가능
5. **Dry Run**: 실제 적용 전 테스트 가능
