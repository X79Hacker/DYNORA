@echo off
cd /d "%~dp0"
echo DYNORA People & Scene Studio V7 - source plus prebuilt app
where py >nul 2>nul
if not errorlevel 1 (
 py -3 server.py %*
 goto end
)
where python >nul 2>nul
if not errorlevel 1 (
 python server.py %*
 goto end
)
echo Python 3 was not found. You can also use npm ci and npm run dev.
:end
pause
