@echo off
chcp 65001 >nul
title DailyApp 관리

:menu
cls
echo.
echo  ╔═══════════════════════════════════════╗
echo  ║       DailyApp 관리 프로그램          ║
echo  ╠═══════════════════════════════════════╣
echo  ║                                       ║
echo  ║   [1] 지금 실행                       ║
echo  ║   [2] 자동실행 켜기 (매일 9시)        ║
echo  ║   [3] 자동실행 끄기                   ║
echo  ║   [4] 상태 확인                       ║
echo  ║   [5] 종료                            ║
echo  ║                                       ║
echo  ╚═══════════════════════════════════════╝
echo.
set /p choice=선택:

if "%choice%"=="1" goto run
if "%choice%"=="2" goto enable
if "%choice%"=="3" goto disable
if "%choice%"=="4" goto status
if "%choice%"=="5" exit
goto menu

:run
cls
echo.
echo 실행 중...
echo.
cd /d C:\Users\Admin\Documents\GitHub\DailyApp
call npm run collect
call npm run analyze
call npm run save
call npm run kakao:send
echo.
echo 완료!
pause
goto menu

:enable
schtasks /change /tn "DailyAppReport" /enable >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo ✅ 자동실행 켜짐 (매일 아침 9시)
) else (
    echo.
    echo ❌ 오류 발생
)
pause
goto menu

:disable
schtasks /change /tn "DailyAppReport" /disable >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo ✅ 자동실행 꺼짐
) else (
    echo.
    echo ❌ 오류 발생
)
pause
goto menu

:status
echo.
schtasks /query /tn "DailyAppReport" /fo list | findstr "상태 Status"
echo.
pause
goto menu
