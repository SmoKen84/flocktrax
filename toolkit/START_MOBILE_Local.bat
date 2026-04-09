@echo off
setlocal
title FlockTrax-Mobile Local EXPO Server
color 0C

set "PROJ=C:\dev\FlockTrax\mobile"

echo.
echo =========================================
echo   START FlockTrax-Mobile EXPO SERVER
echo =========================================
echo   Used for testing Mobile app on iOS
echo    Both iOS and Windows must be on 
echo    SAME WiFi Router Service "SmoWiFi"
echo           ** LOCAL TESTING **
echo =========================================
echo.

choice /c YN /m "Proceed with FlockTrax-Mobile EXPO START?"
if errorlevel 2 (
  echo Cancelled.
  pause
  exit /b 0
)

cd /d "%PROJ%" || (echo ERROR: Project path missing. & pause & exit /b 1)

echo.
echo Starting EXPO Server...
echo
echo  ** Once Started access the iOS Mobile App
echo     by SCANNING QR-Code or SCANNING
echo     from EXPO GO within iOS
echo
npm run start
if errorlevel 1 (
  echo ERROR: Loading EXPO Environment
  pause
  exit /b 1
)

echo.
echo Exiting EXPO GO
pause
endlocal
