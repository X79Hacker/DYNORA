@echo off
cd /d "%~dp0"
echo DYNORA V15.8.4
echo Open http://localhost:8000 in Chrome or Edge.
echo Close this window or press Ctrl+C to stop.
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -m http.server 8000 --bind 127.0.0.1 --directory dist
) else (
  python -m http.server 8000 --bind 127.0.0.1 --directory dist
)
pause
