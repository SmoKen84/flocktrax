@echo off
setlocal
title FlockTrax - DEPLOY FUNCTIONS (LOCAL)
color 0A

set "PROJ=%~dp0.."

if "%FLOCKTRAX_SUPABASE_PROJECT_REF%"=="" (
  echo ERROR: FLOCKTRAX_SUPABASE_PROJECT_REF must be set explicitly.
  echo No production project fallback is permitted.
  exit /b 1
)
set "PROJECT_REF=%FLOCKTRAX_SUPABASE_PROJECT_REF%"

cd /d "%PROJ%" || (echo ERROR: Project path missing. & pause & exit /b 1)

echo.
echo =========================================
echo   Deploy Edge Functions to LOCAL
echo =========================================
echo.

supabase status >nul 2>&1
if errorlevel 1 (
  echo ERROR: Supabase local stack not running.
  echo Run toolkit\START_FLOCKTRAX_DEV.bat first.
  pause
  exit /b 1
)

echo Deploying hello-world...
supabase functions deploy hello-world --no-verify-jwt --project-ref %PROJECT_REF%
if errorlevel 1 (echo ERROR deploying hello-world & pause & exit /b 1)

echo Deploying log-daily-upsert...
supabase functions deploy log-daily-upsert --no-verify-jwt --project-ref %PROJECT_REF%
if errorlevel 1 (echo ERROR deploying log-daily-upsert & pause & exit /b 1)

echo.
echo Done.
pause
endlocal
