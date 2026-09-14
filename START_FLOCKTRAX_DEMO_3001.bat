@echo off
setlocal EnableExtensions EnableDelayedExpansion
title FlockTrax DEMO - Localhost 3001
color 4F

set "DEMO_ROOT=C:\dev\FlockTrax-Demo-Hosted"
set "ADMIN_DIR=%DEMO_ROOT%\web-admin"
set "DEMO_PROJECT_REF=srkgobayrzidytmvoago"
set "PRODUCTION_PROJECT_REF=frneaccbbrijpolcesjm"
set "LOCAL_URL=http://localhost:3001"

echo.
echo ========================================================
echo   FLOCKTRAX DEMO - LOCAL SERVER
echo   URL:  %LOCAL_URL%
echo   Data: isolated hosted DEMO Supabase project
echo ========================================================
echo.

if not exist "%ADMIN_DIR%\package.json" (
  echo ERROR: Demo Admin project was not found:
  echo   %ADMIN_DIR%
  pause
  exit /b 1
)

if not exist "%ADMIN_DIR%\.vercel\project.json" (
  echo ERROR: The demo worktree is not linked to a Vercel project.
  echo Expected: %ADMIN_DIR%\.vercel\project.json
  pause
  exit /b 1
)

findstr /I /C:"flocktrax-demo" "%ADMIN_DIR%\.vercel\project.json" >nul
if errorlevel 1 (
  echo ERROR: Refusing to start because this worktree is not linked to
  echo the flocktrax-demo Vercel project.
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
  echo ERROR: Port 3001 is already in use.
  echo Close the existing server or window and run this launcher again.
  pause
  exit /b 1
)

cd /d "%ADMIN_DIR%"
if errorlevel 1 (
  echo ERROR: Could not enter the demo Admin directory.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo First run: downloading the linked DEMO project's environment...
  where vercel >nul 2>&1
  if errorlevel 1 (
    call npx --yes vercel@latest env pull .env.local --environment=production --yes
  ) else (
    call vercel env pull .env.local --environment=production --yes
  )
  if errorlevel 1 (
    echo ERROR: Could not download the demo environment from Vercel.
    echo Sign in to the Vercel CLI if requested, then run this file again.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%DEMO_ROOT%\toolkit\Ensure-DemoLocalEnvironment.ps1" -EnvFile "%ADMIN_DIR%\.env.local" -DemoProjectRef "%DEMO_PROJECT_REF%" -ProductionProjectRef "%PRODUCTION_PROJECT_REF%"
if errorlevel 1 (
  echo ERROR: The private demo Admin environment could not be prepared.
  echo The server was NOT started.
  pause
  exit /b 1
)

set "LOCAL_SUPABASE_URL="
for /f "usebackq tokens=1,* delims==" %%A in (".env.local") do (
  if /I "%%A"=="NEXT_PUBLIC_SUPABASE_URL" set "LOCAL_SUPABASE_URL=%%B"
)
set "LOCAL_SUPABASE_URL=!LOCAL_SUPABASE_URL:"=!"
set "LOCAL_SUPABASE_URL=!LOCAL_SUPABASE_URL:'=!"

echo(!LOCAL_SUPABASE_URL! | findstr /I /C:"%DEMO_PROJECT_REF%" >nul
if errorlevel 1 (
  echo ERROR: Refusing to start. .env.local does not identify the expected
  echo DEMO Supabase project: %DEMO_PROJECT_REF%
  echo Delete web-admin\.env.local and run this launcher again to refresh it.
  pause
  exit /b 1
)

echo(!LOCAL_SUPABASE_URL! | findstr /I /C:"%PRODUCTION_PROJECT_REF%" >nul
if not errorlevel 1 (
  echo ERROR: PRODUCTION Supabase reference detected in the demo environment.
  echo The server was NOT started.
  pause
  exit /b 1
)

set "FLOCKTRAX_ENVIRONMENT_NAME=demo"
set "FLOCKTRAX_PRODUCTION_SUPABASE_PROJECT_REF=%PRODUCTION_PROJECT_REF%"
set "FLOCKTRAX_PRODUCTION_APP_HOST=flocktrax.com"
set "FLOCKTRAX_OUTBOUND_MODE=disabled"
set "NEXT_PUBLIC_APP_URL=%LOCAL_URL%"

if not exist "node_modules\next\dist\bin\next" (
  echo Installing Admin dependencies for this worktree...
  call npm ci
  if errorlevel 1 (
    echo ERROR: npm ci failed.
    pause
    exit /b 1
  )
)

echo.
echo Safety checks passed.
echo Starting FlockTrax Demo at %LOCAL_URL%
echo Keep this window open while using the demo.
echo Press Ctrl+C in this window to stop it.
echo.

call npm run dev -- --port 3001
set "SERVER_EXIT=%ERRORLEVEL%"

echo.
if not "%SERVER_EXIT%"=="0" echo ERROR: The demo server exited with code %SERVER_EXIT%.
echo FlockTrax Demo localhost has stopped.
pause
exit /b %SERVER_EXIT%
