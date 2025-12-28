@echo off
cd /d C:\Users\Admin\Documents\GitHub\DailyApp
call npm run collect
call npm run analyze
call npm run save

echo.
echo Pushing to GitHub...
git add web/data/reports/*.json
git commit -m "Daily report %date%"
git push origin main

call npm run kakao:send
