@echo off
setlocal
title FlockTrax - TOOLKIT MENU
color 0F

set "DIR=%~dp0"

:menu
cls
echo =========================================
echo   FLOCKTRAX DEV TOOLKIT
echo =========================================
echo   1) START dev stack
echo   2) STOP dev stack
echo   3) RESET local DB (DESTRUCTIVE)
echo   4) CAPTURE logs bundle
echo   5) DEPLOY functions (LOCAL)
echo   6) TEST functions (LOCAL)
echo
echo   8) START FlockTrax-Mobile iOS Server (LOCAL)
echo   9) START FlockTrax-Admin Server (LOCAL)

echo   Q) Quit
echo =========================================
echo.

set /p choice=Select option: 

if /i "%choice%"=="1" call "%DIR%START_FLOCKTRAX_DEV.bat" & goto menu
if /i "%choice%"=="2" call "%DIR%STOP_FLOCKTRAX_DEV.bat" & goto menu
if /i "%choice%"=="3" call "%DIR%RESET_LOCAL_DB.bat" & goto menu
if /i "%choice%"=="4" call "%DIR%CAPTURE_LOGS.bat" & goto menu
if /i "%choice%"=="5" call "%DIR%DEPLOY_FUNCTIONS_LOCAL.bat" & goto menu
if /i "%choice%"=="6" call "%DIR%TEST_FUNCTIONS_LOCAL.bat" & goto menu
if /i "%choice%"=="8" call "%DIR%START_MOBILE_Local.bat" & goto menu
if /i "%choice%"=="9" call "%DIR%START_ADMIN_Local.bat" & goto menu

if /i "%choice%"=="Q" exit /b 0


echo Invalid selection.
timeout /t 2 >nul
goto menu
