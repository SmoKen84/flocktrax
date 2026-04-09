@echo off
setlocal enabledelayedexpansion

REM =========================================
REM  RESTORE CLEAN SUPABASE DB VOLUME
REM  Restores supabase_db_FlockTrax from a .tgz
REM =========================================

set ROOT=%~dp0..
pushd "%ROOT%" >nul

REM --- Pick latest tgz if none provided ---
set TGZ=%~1
if "%TGZ%"=="" (
  for /f "delims=" %%F in ('dir /b /o:-d "FlockTrax_db_volume_*.tgz" 2^>nul') do (
    set TGZ=%%F
    goto :got
  )
)

:got
if "%TGZ%"=="" (
  echo ERROR: No FlockTrax_db_volume_*.tgz found in %CD%
  exit /b 1
)

if not exist "%TGZ%" (
  echo ERROR: Archive not found: %TGZ%
  exit /b 1
)

echo =========================================
echo  Restoring DB volume from:
echo   %CD%\%TGZ%
echo =========================================

echo [1/5] Stopping Supabase...
supabase stop --no-backup

echo [2/5] Removing old DB volume (supabase_db_FlockTrax)...
docker volume rm supabase_db_FlockTrax >nul 2>&1

echo [3/5] Creating fresh DB volume...
docker volume create supabase_db_FlockTrax >nul

echo [4/5] Extracting archive into DB volume...
docker run --rm ^
  -v supabase_db_FlockTrax:/volume ^
  -v "%CD%":/backup ^
  alpine sh -lc "cd /volume && tar -xzf /backup/%TGZ%"

echo [5/5] Starting Supabase...
supabase start

echo Done.
popd >nul
endlocal
