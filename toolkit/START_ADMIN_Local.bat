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

if not defined GOOGLE_APPLICATION_CREDENTIALS (
  if exist "C:\dev-secrets\flocktrax-sync-e2fddb60793f.json" (
    set "GOOGLE_APPLICATION_CREDENTIALS=C:\dev-secrets\flocktrax-sync-e2fddb60793f.json"
  ) else if exist "C:\dev\gpc_engine\secrets\gpc-syncengine-02623a353a42.json" (
    set "GOOGLE_APPLICATION_CREDENTIALS=C:\dev\gpc_engine\secrets\gpc-syncengine-02623a353a42.json"
  ) else if exist "C:\dev\gpc_engine\secrets\gpc-syncengine-SA.json" (
    set "GOOGLE_APPLICATION_CREDENTIALS=C:\dev\gpc_engine\secrets\gpc-syncengine-SA.json"
  ) else if exist "C:\dev\gpc_engine\SQL2Sheets\gsheetssync-476008-f3b390eacd89.json" (
    set "GOOGLE_APPLICATION_CREDENTIALS=C:\dev\gpc_engine\SQL2Sheets\gsheetssync-476008-f3b390eacd89.json"
  )
)

echo.
echo Starting LocalHost Server...
echo
echo  ** Once Started access the Admin Console
echo     at "LOCALHOST:3000" from any local browser
echo     on this computer
echo
if defined GOOGLE_APPLICATION_CREDENTIALS echo  Google credentials loaded from: %GOOGLE_APPLICATION_CREDENTIALS%
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
