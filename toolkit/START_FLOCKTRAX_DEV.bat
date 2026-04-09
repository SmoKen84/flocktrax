@echo off
setlocal EnableExtensions EnableDelayedExpansion
title FlockTrax - START Dev Toolkit
color 0A

set "PROJ=C:\dev\FlockTrax"
set "LOGDIR=%PROJ%\toolkit\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo.
echo =========================================
echo   FLOCKTRAX DEV STARTUP
echo   Project: %PROJ%
echo =========================================
echo.

if not exist "%PROJ%\" (
  echo ERROR: Project folder not found: %PROJ%
  pause
  exit /b 1
)

where supabase >nul 2>&1
if errorlevel 1 (
  echo ERROR: supabase CLI not found on PATH.
  echo Fix: Ensure Scoop shims are on PATH, or install via: scoop install supabase
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: docker not found on PATH - Docker Desktop likely not installed.
  echo Fix: Install Docker Desktop and ensure docker.exe is on PATH.
  pause
  exit /b 1
)

echo [1/6] Checking Docker engine...
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker engine not ready. Launching Docker Desktop...
  if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ) else (
    echo WARNING: Docker Desktop EXE not found at default path.
    echo Please start Docker Desktop manually, then re-run this script.
    pause
    exit /b 1
  )

  echo Waiting for Docker engine to become ready - max about 180 seconds...
  set /a tries=0
  :wait_docker
  timeout /t 5 /nobreak >nul
  docker info >nul 2>&1
  if not errorlevel 1 goto docker_ok
  set /a tries+=1
  if !tries! geq 36 (
    echo ERROR: Docker engine did not become ready in time.
    echo Open Docker Desktop and confirm it reaches Running.
    pause
    exit /b 1
  )
  goto wait_docker
) else (
  echo Docker engine is ready.
  pause
)

:docker_ok

echo.
echo [2/6] Changing directory...
cd /d "%PROJ%"
if errorlevel 1 (
  echo ERROR: Could not cd to %PROJ%
  pause
  exit /b 1
)

echo.
echo [3/6] Starting Supabase local stack...
supabase start
if errorlevel 1 (
  echo ERROR: supabase start failed.
  echo Tip: Run toolkit\CAPTURE_LOGS.bat and inspect outputs.
  pause
  exit /b 1
)

echo.
echo [4/6] Supabase status:
supabase status

echo.
echo [5/6] Opening Supabase Studio...
start "" http://127.0.0.1:54323

echo.
echo [6/6] Opening editor...
where code >nul 2>&1
if errorlevel 1 (
  echo VS Code CLI not found - skipping.
) else (
  start "" code "%PROJ%"
)

echo.
echo =========================================
echo   DEV STACK READY
echo =========================================
echo.
pause
endlocal
