@echo off
setlocal
cd /d "%~dp0"
py -3 scripts\local-sync-gui.py
if errorlevel 1 (
  echo.
  echo MB-BUDGET Local Data Sync failed to start.
  echo Install Python 3 with required packages, then run this launcher again.
  pause
)
