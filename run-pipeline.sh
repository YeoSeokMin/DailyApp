#!/bin/bash
# DailyApp 자동 파이프라인
#
# ★2026-09-22 개정: 각 단계의 종료코드를 확인한다.
#   구 버전은 종료코드를 전혀 안 봐서, analyze 가 죽어도 save→push→카톡이 그대로 돌았다.
#   그 결과 2026-06-16 ~ 09-22 (98일) 동안 매일 낡은 리포트가 카톡으로 나갔고
#   로그 마지막 줄은 항상 "파이프라인 완료" 였다.
cd /home/opc/apps/dailyapp || exit 1
export PATH=$HOME/.nvm/versions/node/v20.20.1/bin:$PATH:/usr/local/bin
export AI_USAGE_APP=dailyapp

LOG_FILE=/home/opc/apps/dailyapp/output/pipeline_$(date +%Y%m%d).log
REPORT=/home/opc/apps/dailyapp/output/report.json

log() { echo "[$(date)] $*" >> "$LOG_FILE"; }

# 실패 알림 (aiFeed 의 디스코드 웹훅 재사용)
notify_fail() {
  local step="$1" code="$2"
  log "❌ 중단: ${step} 실패 (exit=${code})"
  local hook
  hook=$(grep -m1 '^DISCORD_WEBHOOK_URL=' /home/opc/apps/aiFeed/.env 2>/dev/null | cut -d= -f2-)
  [ -z "$hook" ] && return 0
  local tail_log
  tail_log=$(tail -n 15 "$LOG_FILE" 2>/dev/null | sed 's/"/\\"/g' | tr '\n' '\001' | sed 's/\x01/\\n/g')
  curl -sS -m 20 -X POST -H 'Content-Type: application/json' \
    -d "{\"content\":\"🚨 **DailyApp 파이프라인 중단**\\n단계: ${step} (exit ${code})\\n리포트를 저장/발송하지 않았습니다.\\n\`\`\`\\n${tail_log}\\n\`\`\`\"}" \
    "$hook" >/dev/null 2>&1
}

run_step() {
  local name="$1"; shift
  log "${name} 시작"
  "$@" >> "$LOG_FILE" 2>&1
  local code=$?
  if [ $code -ne 0 ]; then
    notify_fail "$name" "$code"
    exit $code
  fi
  log "${name} 완료"
}

log "파이프라인 시작"

run_step "앱 데이터 수집" npm run collect
run_step "분석" npm run analyze

# ★분석이 성공했다고 해도 리포트가 오늘 날짜인지 확인한다(이중 안전장치).
TODAY=$(date +%Y-%m-%d)
REPORT_DATE=$(python3 -c "
import json,sys
try:
    print(json.load(open('$REPORT',encoding='utf-8')).get('date',''))
except Exception:
    print('')
" 2>/dev/null)
if [ "$REPORT_DATE" != "$TODAY" ]; then
  log "리포트 날짜 불일치: report=${REPORT_DATE:-없음} / today=${TODAY}"
  notify_fail "리포트 신선도 검사" 1
  exit 1
fi
log "리포트 날짜 확인: $REPORT_DATE"

run_step "리포트 저장" npm run save

# GitHub push 는 실패해도 치명적이지 않다 — 경고만 남기고 계속한다.
log "GitHub push 시작"
{
  git add web/data/reports/ web/data/deep-reports/ output/trends.json .gitignore
  git commit -m "Daily report $(date +%Y-%m-%d)"
  git push origin main
} >> "$LOG_FILE" 2>&1
if [ $? -ne 0 ]; then
  log "⚠️ GitHub push 실패 (계속 진행)"
else
  log "GitHub push 완료"
fi

run_step "카카오톡 전송" npm run kakao:send

log "파이프라인 완료"
