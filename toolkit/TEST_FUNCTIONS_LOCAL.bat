@echo off
setlocal EnableDelayedExpansion
title FlockTrax - TEST FUNCTIONS (LOCAL)
color 0A

set "PROJ=C:\dev\FlockTrax"
cd /d "%PROJ%" || (echo ERROR: Project path missing. & pause & exit /b 1)

REM Try to auto-detect local publishable key from `supabase status`
set "ANON="
for /f %%i in ('powershell -NoProfile -Command "$s = (supabase status ^| Out-String); if ($s -match ''sb_publishable_[A-Za-z0-9_-]+'') { $matches[0] }"') do set "ANON=%%i"

if "%ANON%"=="" (
  echo ERROR: Could not auto-detect local sb_publishable key from `supabase status`.
  echo Run `supabase status` and copy the Publishable key, then set:
  echo   setx SUPABASE_ANON_KEY "sb_publishable_..."
  echo Then reopen your terminal and re-run this test.
  pause
  exit /b 1
)

echo.
echo =========================================
echo   LOCAL FUNCTION SMOKE TESTS
echo =========================================
echo   Using Authorization Bearer: %ANON%
echo =========================================
echo.

echo [1/2] Testing hello-world...
curl -s -X POST "http://127.0.0.1:54321/functions/v1/hello-world" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %ANON%" ^
  -H "apikey: %ANON%" ^
  -d "{\"name\":\"Ken\"}"
echo.
echo.

set "PLACEMENT_ID=11111111-1111-1111-1111-111111111111"
set "LOG_DATE=2026-02-16"

echo [2/2] Testing log-daily-upsert...
curl -s -X POST "http://127.0.0.1:54321/functions/v1/log-daily-upsert" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %ANON%" ^
  -H "apikey: %ANON%" ^
  -d "{\"placement_id\":\"%PLACEMENT_ID%\",\"log_date\":\"%LOG_DATE%\",\"age_days\":5,\"am_temp\":92.5,\"set_temp\":90,\"water\":100,\"feed\":200}"
echo.
echo.
pause
endlocal
