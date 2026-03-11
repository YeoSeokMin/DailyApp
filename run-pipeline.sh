#!/bin/bash
# DailyApp 자동 파이프라인
cd /home/opc/apps/dailyapp
export PATH=$HOME/.nvm/versions/node/v20.20.1/bin:$PATH:/usr/local/bin

LOG_FILE=/home/opc/apps/dailyapp/output/pipeline_$(date +%Y%m%d).log

echo "[$(date)] 파이프라인 시작" >> $LOG_FILE

# 1. 앱 수집
echo "[$(date)] 앱 데이터 수집 시작" >> $LOG_FILE
npm run collect >> $LOG_FILE 2>&1

# 2. 분석 (Codex CLI + Claude CLI)
echo "[$(date)] 분석 시작" >> $LOG_FILE
npm run analyze >> $LOG_FILE 2>&1

# 3. 리포트 저장
echo "[$(date)] 리포트 저장" >> $LOG_FILE
npm run save >> $LOG_FILE 2>&1

# 4. GitHub 자동 push
echo "[$(date)] GitHub push 시작" >> $LOG_FILE
git add web/data/reports/ output/trends.json >> $LOG_FILE 2>&1
git commit -m "Daily report $(date +%Y-%m-%d)" >> $LOG_FILE 2>&1
git push origin main >> $LOG_FILE 2>&1
echo "[$(date)] GitHub push 완료" >> $LOG_FILE

# 5. 카카오톡 전송
echo "[$(date)] 카카오톡 전송" >> $LOG_FILE
npm run kakao:send >> $LOG_FILE 2>&1

echo "[$(date)] 파이프라인 완료" >> $LOG_FILE
