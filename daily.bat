@echo off
cd /d C:\Users\Admin\Documents\GitHub\DailyApp
call npm run collect
call npm run analyze
call npm run save
call npm run kakao:send
