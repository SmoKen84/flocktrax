@echo off
setlocal

cd /d C:\dev\FlockTrax

supabase functions deploy dashboard-placements-list || goto :fail
supabase functions deploy placement-day-get || goto :fail
supabase functions deploy placement-day-submit || goto :fail

echo.
echo Edge function deploy complete.
goto :done

:fail
echo.
echo Deploy failed.
exit /b 1

:done
endlocal
