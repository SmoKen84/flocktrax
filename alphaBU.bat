@echo off
setlocal

if "%FLOCKTRAX_DATABASE_URL%"=="" (
  echo ERROR: FLOCKTRAX_DATABASE_URL must be set explicitly.
  echo No production database fallback is permitted.
  exit /b 1
)

set "BACKUP_DIR=%~dp0backups\manual-database-backup"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

supabase db dump --db-url "%FLOCKTRAX_DATABASE_URL%" -f "%BACKUP_DIR%\roles.sql" --role-only || exit /b 1
supabase db dump --db-url "%FLOCKTRAX_DATABASE_URL%" -f "%BACKUP_DIR%\schema.sql" || exit /b 1
supabase db dump --db-url "%FLOCKTRAX_DATABASE_URL%" -f "%BACKUP_DIR%\data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes" || exit /b 1

echo Database backup completed in "%BACKUP_DIR%".
endlocal
