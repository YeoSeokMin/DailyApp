#!/bin/bash
set -e
export PATH=$HOME/.nvm/versions/node/v20.20.1/bin:$PATH
TIMESTAMP_DIR=/home/opc/apps/.deploy-timestamps
cd /home/opc/apps/dailyapp

echo "[$(date)] Deploy 시작"
git pull origin main
npm install --production
mkdir -p $TIMESTAMP_DIR
date '+%Y-%m-%d %H:%M:%S' > $TIMESTAMP_DIR/dailyapp.txt
echo "[$(date)] Deploy 완료"
