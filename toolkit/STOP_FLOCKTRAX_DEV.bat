@echo off
setlocal
title FlockTrax - STOP Dev Toolkit
color 0E

set "PROJ=C:\dev\FlockTrax"

echo.
echo =========================================
echo   FLOCKTRAX DEV STOP
echo =========================================
echo.

cd /d "%PROJ%" || (echo ERROR: Project path missing. & pause & exit /b 1)

where supabase >nul 2>&1 || (echo ERROR: supabase CLI not found. & pause & exit /b 1)

echo Stopping Supabase local stack...
supabase stop
if errorlevel 1 (
  echo ERROR: supabase stop failed.
  pause
  exit /b 1
)

echo.
echo Done.
pause
endlocal
