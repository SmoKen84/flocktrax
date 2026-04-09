@echo off
setlocal
title FlockTrax-Admin Local Server
color 0C

set "PROJ=C:\dev\FlockTrax\web-admin"

echo.
echo =========================================
echo   START FlockTrax-Admin LOCAL SERVER
echo =========================================
echo   Used for testing Web-Admin App
echo    LOCAL Testing on HOSTED Data
echo =========================================
echo.

choice /c YN /m "Proceed with FlockTrax-Admin Server Load?"
if errorlevel 2 (
  echo Cancelled.
  pause
  exit /b 0
)

cd /d "%PROJ%" || (echo ERROR: Project path missing. & pause & exit /b 1)

echo.
echo Starting LocalHost Server...
echo
echo  ** Once Started access the Admin Console
echo     at "LOCALHOST:3000" from any local browser
echo     on this computer
echo
npm run dev
if errorlevel 1 (
  echo ERROR: Loading LOCALHOST Server
  pause
  exit /b 1
)

echo.
echo Exiting LOCALHOST Server
pause
endlocal
