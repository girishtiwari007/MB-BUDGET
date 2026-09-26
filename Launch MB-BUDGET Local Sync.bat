@echo off
setlocal
cd /d "%~dp0"
py -3 scripts\local-sync-gui.py
if errorlevel 1 (
  echo.
  echo MB-BUDGET Local Data Sync failed to start.
  echo Install dependencies with: py -3 -m pip install -r requirements.txt
  pause
)
