@echo off
setlocal EnableDelayedExpansion
title FlockTrax - CAPTURE LOGS
color 0B

set "PROJ=C:\dev\FlockTrax"
set "BASE=%PROJ%\toolkit\logs"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
set "OUT=%BASE%\bundle_%TS%"

mkdir "%OUT%" >nul 2>&1

echo.
echo =========================================
echo   CAPTURE LOGS: %OUT%
echo =========================================
echo.

cd /d "%PROJ%" || (echo ERROR: Project path missing. & pause & exit /b 1)

echo Writing supabase_status.txt...
supabase status > "%OUT%\supabase_status.txt" 2>&1

echo Writing docker_ps.txt...
docker ps -a > "%OUT%\docker_ps.txt" 2>&1

echo Writing docker_info.txt...
docker info > "%OUT%\docker_info.txt" 2>&1

echo Writing supabase_logs.txt...
supabase logs > "%OUT%\supabase_logs.txt" 2>&1

echo.
echo Bundle created:
echo %OUT%
echo.
pause
endlocal
