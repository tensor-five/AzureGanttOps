@echo off
setlocal
cd /d "%~dp0"
node scripts\one-click-start.mjs
if errorlevel 1 (
  echo.
  echo Start fehlgeschlagen. Siehe Meldungen oben.
  pause
)
