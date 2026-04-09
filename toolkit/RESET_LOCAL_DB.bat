@echo off
setlocal
title FlockTrax - RESET Local DB
color 0C

set "PROJ=C:\dev\FlockTrax"

echo.
echo =========================================
echo   RESET LOCAL SUPABASE DB (DESTRUCTIVE)
echo =========================================
echo   This WILL delete local data.
echo =========================================
echo.

choice /c YN /m "Proceed with local DB reset?"
if errorlevel 2 (
  echo Cancelled.
  pause
  exit /b 0
)

cd /d "%PROJ%" || (echo ERROR: Project path missing. & pause & exit /b 1)

where supabase >nul 2>&1 || (echo ERROR: supabase CLI not found. & pause & exit /b 1)

echo.
echo Resetting local DB...
supabase db reset
if errorlevel 1 (
  echo ERROR: supabase db reset failed.
  pause
  exit /b 1
)

echo.
echo Reset complete. Showing status:
supabase status

pause
endlocal
