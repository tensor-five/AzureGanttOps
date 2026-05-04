@echo off
setlocal
cd /d "%~dp0"
node scripts\one-click-start.mjs
if errorlevel 1 (
  echo.
  echo Start fehlgeschlagen. Siehe Meldungen oben.
  pause
) else (
  echo.
  echo Server läuft. Fenster kann geschlossen werden oder Strg+C zum Beenden.
  pause
)
